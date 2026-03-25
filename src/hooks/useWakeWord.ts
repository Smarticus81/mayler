import { useRef, useCallback, useEffect, useState } from 'react';
import { useMayler } from '../context/MaylerContext';
import { similarity, sanitize } from '../utils/stringUtils';

/**
 * Wake word detection per OpenAI Voice Pipeline spec.
 * Uses browser SpeechRecognition with maxAlternatives, exponential backoff,
 * and stop/shutdown phrase detection.
 */

// ── Configurable phrase lists ──
export const WAKE_WORDS = [
    'mayler', 'may-ler', 'may ler', 'maylar', 'maylor',
    'hey mayler', 'hey may-ler', 'hey maylar', 'hey maylor',
    'mailer', 'maler', 'miller', 'my ler', 'my lor'
];

export const STOP_PHRASES = [
    "that's all for now", "thats all for now",
    "goodbye", "good bye", "stop listening",
    "that's all", "thats all", "nothing else", "see you",
];

export const SHUTDOWN_PHRASES = ["shut down", "shut it down", "turn off"];

function getSR(): any {
    if (typeof window === 'undefined') return null;
    return (window as any).SpeechRecognition
        || (window as any).webkitSpeechRecognition
        || null;
}

export function isWakeWordSupported(): boolean {
    return getSR() !== null;
}

interface UseWakeWordOptions {
    onWakeWordDetected: () => void;
    onStopDetected: () => void;
    onShutdownDetected: () => void;
    onChime: () => void;
    isActive?: boolean;
    confidenceThreshold?: number;
}

export const useWakeWord = ({
    onWakeWordDetected,
    onStopDetected,
    onShutdownDetected,
    onChime,
    isActive = true,
    confidenceThreshold = 0.4,
}: UseWakeWordOptions) => {
    const { wakeWordEnabled, isWakeMode } = useMayler();
    const [isListening, setIsListening] = useState(false);
    const activeRef = useRef(false);
    const recRef = useRef<any>(null);
    const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const captureFailsRef = useRef(0);

    // Store callbacks in refs to avoid stale closures
    const onWakeRef = useRef(onWakeWordDetected);
    const onStopRef = useRef(onStopDetected);
    const onShutdownRef = useRef(onShutdownDetected);
    const onChimeRef = useRef(onChime);
    const isActiveRef = useRef(isActive);

    useEffect(() => {
        onWakeRef.current = onWakeWordDetected;
        onStopRef.current = onStopDetected;
        onShutdownRef.current = onShutdownDetected;
        onChimeRef.current = onChime;
        isActiveRef.current = isActive;
    }, [onWakeWordDetected, onStopDetected, onShutdownDetected, onChime, isActive]);

    const clearRestartTimer = useCallback(() => {
        if (restartTimerRef.current) {
            clearTimeout(restartTimerRef.current);
            restartTimerRef.current = null;
        }
    }, []);

    const cleanupRec = useCallback(() => {
        const r = recRef.current;
        if (!r) return;
        r.onstart = null;
        r.onresult = null;
        r.onerror = null;
        r.onend = null;
        try { r.stop(); } catch { /* noop */ }
        recRef.current = null;
    }, []);

    const stopWakeRecognition = useCallback(() => {
        activeRef.current = false;
        captureFailsRef.current = 0;
        clearRestartTimer();
        cleanupRec();
        setIsListening(false);
    }, [cleanupRec, clearRestartTimer]);

    const spawnRecRef = useRef<() => void>(() => {});

    const scheduleRetry = useCallback((delayMs: number) => {
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
            restartTimerRef.current = null;
            if (activeRef.current) spawnRecRef.current();
        }, delayMs);
    }, [clearRestartTimer]);

    const spawnRec = useCallback(() => {
        if (!activeRef.current) return;
        const SR = getSR();
        if (!SR) return;

        cleanupRec();

        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';
        rec.maxAlternatives = 3; // Check multiple speech interpretations
        recRef.current = rec;

        rec.onstart = () => {
            if (!activeRef.current) return;
            captureFailsRef.current = 0;
            setIsListening(true);
        };

        rec.onresult = (event: any) => {
            if (!activeRef.current) return;
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const transcripts: string[] = [];
                for (let j = 0; j < result.length; j++) {
                    if (result[j].confidence >= confidenceThreshold || result[j].confidence === 0) {
                        transcripts.push(result[j].transcript.toLowerCase().trim());
                    }
                }
                if (transcripts.length === 0) continue;
                const combined = transcripts.join(' ');

                // Priority: shutdown > stop > wake word
                if (SHUTDOWN_PHRASES.some(p => combined.includes(p))) {
                    stopWakeRecognition();
                    onShutdownRef.current();
                    return;
                }
                if (STOP_PHRASES.some(p => combined.includes(p))) {
                    stopWakeRecognition();
                    onStopRef.current();
                    return;
                }
                if (WAKE_WORDS.some(w => combined.includes(w) || similarity(sanitize(combined), w) > 0.65)) {
                    stopWakeRecognition();
                    onChimeRef.current();
                    onWakeRef.current();
                    return;
                }
            }
        };

        rec.onerror = (e: any) => {
            if (!activeRef.current) return;
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                stopWakeRecognition();
                return; // Fatal: mic denied
            }
            if (e.error === 'audio-capture') {
                // Mic busy (WebRTC using it) — exponential backoff
                captureFailsRef.current += 1;
                const delay = Math.min(600 * captureFailsRef.current, 3000);
                setIsListening(false);
                if (captureFailsRef.current >= 10) { stopWakeRecognition(); return; }
                cleanupRec();
                scheduleRetry(delay);
                return;
            }
        };

        rec.onend = () => {
            if (!activeRef.current) return;
            setIsListening(false);
            recRef.current = null;
            // SpeechRecognition stops periodically — restart quickly
            scheduleRetry(250);
        };

        try { rec.start(); }
        catch { recRef.current = null; scheduleRetry(500); }
    }, [confidenceThreshold, stopWakeRecognition, cleanupRec, scheduleRetry]);

    spawnRecRef.current = spawnRec;

    const startWakeRecognition = useCallback(() => {
        if (!getSR() || activeRef.current) return;
        activeRef.current = true;
        captureFailsRef.current = 0;
        spawnRec();
    }, [spawnRec]);

    useEffect(() => {
        if (wakeWordEnabled && isWakeMode && isActive) {
            startWakeRecognition();
        } else {
            stopWakeRecognition();
        }
        return () => stopWakeRecognition();
    }, [wakeWordEnabled, isWakeMode, isActive, startWakeRecognition, stopWakeRecognition]);

    return {
        isListening,
        startWakeRecognition,
        stopWakeRecognition,
    };
};
