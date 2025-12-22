import { useRef, useCallback, useEffect } from 'react';
import { useMayler } from '../context/MaylerContext';
import { similarity, sanitize } from '../utils/stringUtils';

const WAKE_WORDS = [
    'mayler', 'may-ler', 'may ler', 'maylar', 'maylor',
    'hey mayler', 'hey may-ler', 'hey maylar', 'hey maylor',
    'mailer', 'maler', 'miller', 'my ler', 'my lor'
];

export const useWakeWord = (onWake: () => void, onChime: () => void, isActive: boolean = true) => {
    const { wakeWordEnabled, isWakeMode } = useMayler();
    const recognizerRef = useRef<any>(null);
    const wakeRunningRef = useRef(false);
    const lastWakeTimeRef = useRef(0);
    const DEBOUNCE_MS = 3000; // 3 seconds between wake word triggers

    const detectWakeWord = useCallback((transcript: string) => {
        const s = sanitize(transcript);
        return WAKE_WORDS.some(w => similarity(s, w) > 0.8 || s.includes(w));
    }, []);

    const stopWakeRecognition = useCallback(() => {
        if (recognizerRef.current) {
            recognizerRef.current.onend = null;
            recognizerRef.current.stop();
            recognizerRef.current = null;
        }
        wakeRunningRef.current = false;
    }, []);

    const isActiveRef = useRef(isActive);
    const onWakeRef = useRef(onWake);
    const onChimeRef = useRef(onChime);

    // Update refs when props change
    useEffect(() => {
        isActiveRef.current = isActive;
        onWakeRef.current = onWake;
        onChimeRef.current = onChime;
    }, [isActive, onWake, onChime]);

    const startWakeRecognition = useCallback(() => {
        // Double check active status via ref to avoid stale closures
        // Also check if we are already running to avoid duplicate instances
        if (wakeRunningRef.current || !isActiveRef.current) return;

        console.log('[Wake Word] Starting recognition...');

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            const results = event.results;
            const idx = event.resultIndex;
            const transcript = results[idx][0].transcript;
            const isFinal = results[idx].isFinal;

            if (isFinal || results[idx][0].confidence > 0.5) {
                if (detectWakeWord(transcript)) {
                    // Debounce: only trigger if enough time has passed
                    const now = Date.now();
                    if (now - lastWakeTimeRef.current > DEBOUNCE_MS) {
                        lastWakeTimeRef.current = now;
                        onChimeRef.current(); // Use ref
                        onWakeRef.current();  // Use ref
                    } else {
                        console.log('[Wake Word] Debounced - too soon after last trigger');
                    }
                }
            }
        };

        recognition.onend = () => {
            wakeRunningRef.current = false;
            // Check ref to see if we should still be running
            if (wakeWordEnabled && isWakeMode && isActiveRef.current) {
                setTimeout(() => startWakeRecognition(), 1000);
            }
        };

        try {
            recognition.start();
            wakeRunningRef.current = true;
            recognizerRef.current = recognition;
        } catch (e) {
            console.error('Wake recognition start error:', e);
        }
    }, [detectWakeWord, stopWakeRecognition, wakeWordEnabled, isWakeMode]); // Removed callback deps

    useEffect(() => {
        if (wakeWordEnabled && isWakeMode && isActive) {
            startWakeRecognition();
        } else {
            stopWakeRecognition();
        }
        return () => stopWakeRecognition();
    }, [wakeWordEnabled, isWakeMode, isActive, startWakeRecognition, stopWakeRecognition]);

    return {
        startWakeRecognition,
        stopWakeRecognition,
    };
};
