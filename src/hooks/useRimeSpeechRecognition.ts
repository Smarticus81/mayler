import { useCallback, useRef, useState, useEffect } from 'react';

interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
}

export const useRimeSpeechRecognition = () => {
    const recognitionRef = useRef<any>(null);
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [isSupported, setIsSupported] = useState(false);
    const onTranscriptCallbackRef = useRef<((text: string) => void) | null>(null);

    useEffect(() => {
        // Check browser support
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        setIsSupported(!!SpeechRecognition);
    }, []);

    const startListening = useCallback((onTranscript: (text: string) => void) => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.error('Speech recognition not supported in this browser');
            return;
        }

        onTranscriptCallbackRef.current = onTranscript;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            console.log('Speech recognition started');
            setIsListening(true);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interimText = '';
            let finalText = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const transcriptText = result[0].transcript;

                if (result.isFinal) {
                    finalText += transcriptText + ' ';
                } else {
                    interimText += transcriptText;
                }
            }

            if (interimText) {
                setInterimTranscript(interimText);
            }

            if (finalText.trim()) {
                const cleanText = finalText.trim();
                setTranscript(cleanText);
                setInterimTranscript('');

                if (onTranscriptCallbackRef.current) {
                    onTranscriptCallbackRef.current(cleanText);
                }
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Speech recognition error:', event.error, event.message);

            // Don't try to restart on these errors
            if (event.error === 'no-speech' || event.error === 'aborted') {
                return;
            }

            // For network errors, try to restart after a delay
            if (event.error === 'network') {
                setTimeout(() => {
                    if (recognitionRef.current === recognition) {
                        try {
                            recognition.start();
                        } catch (e) {
                            console.error('Failed to restart recognition:', e);
                        }
                    }
                }, 1000);
            }
        };

        recognition.onend = () => {
            console.log('Speech recognition ended');

            // Only auto-restart if we're still connected and the ref exists
            if (recognitionRef.current === recognition) {
                try {
                    recognition.start();
                } catch (e) {
                    console.error('Failed to restart recognition:', e);
                    setIsListening(false);
                }
            } else {
                setIsListening(false);
            }
        };

        try {
            recognition.start();
            recognitionRef.current = recognition;
        } catch (error) {
            console.error('Failed to start speech recognition:', error);
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
                recognitionRef.current = null;
                setIsListening(false);
                setInterimTranscript('');
            } catch (error) {
                console.error('Failed to stop speech recognition:', error);
            }
        }
    }, []);

    return {
        startListening,
        stopListening,
        isListening,
        transcript,
        interimTranscript,
        isSupported
    };
};
