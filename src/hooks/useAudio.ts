import { useRef, useCallback, useEffect } from 'react';

/**
 * Sound design system per OpenAI Voice Pipeline spec.
 * Web Audio API micro-sounds — no audio files needed.
 */
export const useAudio = () => {
    const audioContextRef = useRef<AudioContext | null>(null);

    const initAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            const Ctx = window.AudioContext || (window as any).webkitAudioContext;
            try {
                audioContextRef.current = new Ctx();
            } catch (error) {
                console.error('Failed to create AudioContext:', error);
            }
        }

        if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume().catch(err => {
                console.error('Failed to resume AudioContext:', err);
            });
        }

        return audioContextRef.current;
    }, []);

    useEffect(() => {
        return () => {
            audioContextRef.current?.close().catch(() => { });
        };
    }, []);

    // Core tone helper used by all sounds
    const playTone = useCallback((
        freq: number,
        duration: number,
        type: OscillatorType = 'sine',
        gain = 0.12,
        rampDown = true,
    ) => {
        const ac = initAudioContext();
        if (!ac) return;
        try {
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            g.gain.value = gain;
            if (rampDown) g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
            osc.connect(g).connect(ac.destination);
            osc.start();
            osc.stop(ac.currentTime + duration);
        } catch (error) {
            console.error('Failed to play tone:', error);
        }
    }, [initAudioContext]);

    /** Activation — two rising tones */
    const soundWake = useCallback(() => {
        playTone(180, 0.18, 'sine', 0.10);
        setTimeout(() => playTone(260, 0.14, 'sine', 0.08), 100);
    }, [playTone]);

    /** Positive action — bright clink */
    const soundItemAdd = useCallback(() => {
        playTone(880, 0.06, 'sine', 0.08);
        setTimeout(() => playTone(1100, 0.08, 'sine', 0.06), 50);
    }, [playTone]);

    /** Success — ascending triad */
    const soundSubmit = useCallback(() => {
        playTone(520, 0.08, 'triangle', 0.10);
        setTimeout(() => playTone(660, 0.08, 'triangle', 0.08), 80);
        setTimeout(() => playTone(880, 0.12, 'triangle', 0.10), 160);
    }, [playTone]);

    /** Error — hollow tap */
    const soundError = useCallback(() => {
        playTone(220, 0.15, 'square', 0.05);
    }, [playTone]);

    /** Deactivation — descending tones */
    const soundSleep = useCallback(() => {
        playTone(440, 0.12, 'sine', 0.06);
        setTimeout(() => playTone(330, 0.15, 'sine', 0.05), 100);
    }, [playTone]);

    // Legacy aliases for backwards compatibility
    const playWakeChime = soundWake;

    const playGreeting = useCallback(() => {
        const greetings = ["I'm here.", "Yes?", "Listening.", "Go ahead.", "Ready."];
        const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(randomGreeting);
            utterance.rate = 1.2;
            utterance.volume = 0.8;
            window.speechSynthesis.speak(utterance);
        }
    }, []);

    return {
        initAudioContext,
        playWakeChime,
        playGreeting,
        // Spec sound design system
        soundWake,
        soundItemAdd,
        soundSubmit,
        soundError,
        soundSleep,
    };
};
