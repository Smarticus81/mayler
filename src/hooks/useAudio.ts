import { useRef, useCallback, useEffect } from 'react';

export const useAudio = () => {
    const audioContextRef = useRef<AudioContext | null>(null);

    const initAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
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

    const playWakeChime = useCallback(() => {
        const ctx = initAudioContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;

            // Create a pleasant two-tone chime (C5 -> E5)
            const oscillator1 = ctx.createOscillator();
            const oscillator2 = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator1.type = 'sine';
            oscillator1.frequency.setValueAtTime(523.25, now);

            oscillator2.type = 'sine';
            oscillator2.frequency.setValueAtTime(659.25, now + 0.05);

            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.15, now + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

            oscillator1.connect(gainNode);
            oscillator2.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator1.start(now);
            oscillator1.stop(now + 0.2);
            oscillator2.start(now + 0.05);
            oscillator2.stop(now + 0.4);
        } catch (error) {
            console.error('Failed to play wake chime:', error);
        }
    }, [initAudioContext]);

    return {
        initAudioContext,
        playWakeChime,
    };
};
