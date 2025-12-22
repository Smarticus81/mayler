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

    const startWakeRecognition = useCallback(() => {
        if (wakeRunningRef.current) return;

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
                        onChime();
                        onWake();
                    } else {
                        console.log('[Wake Word] Debounced - too soon after last trigger');
                    }
                }
            }
        };

        recognition.onend = () => {
            wakeRunningRef.current = false;
            if (wakeWordEnabled && isWakeMode) {
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
    }, [detectWakeWord, onWake, onChime, stopWakeRecognition, wakeWordEnabled, isWakeMode]);

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
