import { useRef, useEffect, useCallback } from 'react';
import { useMayler } from '../context/MaylerContext';

const GREETINGS = [
    "Hey! What can I help you with?",
    "I'm listening!",
    "Yes?",
    "How can I assist you?",
    "Ready when you are!"
];

export const useGreeting = () => {
    const { selectedVoice } = useMayler();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const greetingCacheRef = useRef<Map<string, string>>(new Map());
    const isLoadingRef = useRef(false);
    const currentVoiceRef = useRef(selectedVoice);

    // Pre-generate and cache greeting audio when voice changes
    useEffect(() => {
        // Skip if voice hasn't changed
        if (currentVoiceRef.current === selectedVoice && greetingCacheRef.current.size > 0) {
            return;
        }

        currentVoiceRef.current = selectedVoice;

        const preloadGreetings = async () => {
            if (isLoadingRef.current) return;
            isLoadingRef.current = true;

            console.log(`🎤 Pre-loading greeting audio with voice: ${selectedVoice}...`);

            // Clear old cache
            greetingCacheRef.current.forEach(url => URL.revokeObjectURL(url));
            greetingCacheRef.current.clear();

            try {
                // Generate first greeting immediately
                const firstGreeting = GREETINGS[0];
                const response = await fetch('/api/rime/generate-greeting', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: firstGreeting, voice: selectedVoice }),
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    greetingCacheRef.current.set(firstGreeting, url);
                    console.log('✅ First greeting cached');

                    // Pre-load audio element
                    audioRef.current = new Audio(url);
                    audioRef.current.preload = 'auto';
                }

                // Generate remaining greetings in background
                for (let i = 1; i < GREETINGS.length; i++) {
                    const greeting = GREETINGS[i];
                    try {
                        const resp = await fetch('/api/rime/generate-greeting', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ text: greeting, voice: selectedVoice }),
                        });

                        if (resp.ok) {
                            const blob = await resp.blob();
                            const url = URL.createObjectURL(blob);
                            greetingCacheRef.current.set(greeting, url);
                            console.log(`✅ Cached greeting ${i + 1}/${GREETINGS.length}`);
                        }
                    } catch (err) {
                        console.warn(`Failed to cache greeting: ${greeting}`, err);
                    }
                }
            } catch (error) {
                console.error('Failed to pre-load greetings:', error);
            } finally {
                isLoadingRef.current = false;
            }
        };

        preloadGreetings();

        // Cleanup
        return () => {
            greetingCacheRef.current.forEach(url => URL.revokeObjectURL(url));
            greetingCacheRef.current.clear();
        };
    }, [selectedVoice]);

    const playGreeting = useCallback(() => {
        // Pick random greeting
        const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
        const audioUrl = greetingCacheRef.current.get(greeting);

        if (audioUrl) {
            console.log('🔊 Playing instant greeting:', greeting);

            // Create new audio instance for this playback
            const audio = new Audio(audioUrl);
            audio.volume = 1.0;

            audio.play().catch(err => {
                console.error('Failed to play greeting:', err);
            });

            return audio;
        } else {
            console.warn('No cached greeting available, using fallback');
            // Fallback: use first cached greeting or nothing
            const firstUrl = greetingCacheRef.current.values().next().value;
            if (firstUrl) {
                const audio = new Audio(firstUrl);
                audio.play().catch(err => console.error('Fallback greeting failed:', err));
                return audio;
            }
        }

        return null;
    }, []);

    return {
        playGreeting,
        isReady: greetingCacheRef.current.size > 0,
    };
};
