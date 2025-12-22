import { useCallback, useRef, useState, useEffect } from 'react';
import { useRimeSpeechRecognition } from './useRimeSpeechRecognition';
import { useToolkit } from './useToolkit';
import { useMayler } from '../context/MaylerContext';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface AudioQueueItem {
    audio: HTMLAudioElement;
    url: string;
}

export const useRimePipeline = () => {
    const { rimeSpeakerId, rimeModelId, setError, setSpeaking, setListening, setTranscript, setInterimTranscript, setAgentTranscript, setAgentInterimTranscript } = useMayler();
    const { runTool, toolkitDefinitions } = useToolkit();
    const { startListening, stopListening, isListening: speechIsListening, interimTranscript: speechInterim, isSupported } = useRimeSpeechRecognition();

    const [connected, setConnected] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const conversationRef = useRef<Message[]>([
        {
            role: 'system',
            content: `You are Mayler, an advanced intelligent voice interface. 

CORE BEHAVIOR RULES:
1. BE CONCISE: Keep responses extremely short and conversational.
2. COMMAND MODE: Execute tools immediately when asked.
3. TERMINATION: If the user says "Goodbye", "Bye", "Stop listening", "Shutdown", or "Go to sleep":
   - Say "Goodbye" briefly.
   - Then immediately call the 'disconnect_session' tool or stop responding.
   - Do NOT ask for confirmation. Just stop.

4. PERSONALITY: Professional, helpful, zen, and laid-back.
5. TOOLS: Use Gmail, Calendar, and Search tools proactively.
   - If authentication fails, ask the user to "Connect Google Account" in settings.

Your goal is to be the ultimate helpful assistant.`
        }
    ]);
    const audioQueueRef = useRef<AudioQueueItem[]>([]);
    const isPlayingRef = useRef(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Initialize audio context for level analysis
    const initAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContextClass();
        }
        return audioContextRef.current;
    }, []);

    const playNextAudio = useCallback(() => {
        if (isPlayingRef.current || audioQueueRef.current.length === 0) {
            return;
        }

        const item = audioQueueRef.current.shift();
        if (!item) return;

        const { audio, url } = item;
        isPlayingRef.current = true;
        setSpeaking(true);

        audio.onended = () => {
            isPlayingRef.current = false;
            setSpeaking(false);
            setAudioLevel(0);
            URL.revokeObjectURL(url);

            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }

            // Play next in queue
            if (audioQueueRef.current.length > 0) {
                playNextAudio();
            }
        };

        audio.onerror = (e) => {
            console.error('[Rime] Audio playback error:', e);
            isPlayingRef.current = false;
            setSpeaking(false);
            setAudioLevel(0);
            URL.revokeObjectURL(url);

            // Try next in queue
            if (audioQueueRef.current.length > 0) {
                playNextAudio();
            }
        };

        audio.play().then(() => {
            // Start audio analysis after playback begins
            // Note: We can't use createMediaElementSource on the same element twice
            // So we'll simulate audio level based on playback
            const simulateLevel = () => {
                if (!isPlayingRef.current) {
                    setAudioLevel(0);
                    return;
                }
                // Simulate varying audio levels
                const level = 0.3 + Math.random() * 0.4;
                setAudioLevel(level);
                animationFrameRef.current = requestAnimationFrame(simulateLevel);
            };
            simulateLevel();
        }).catch(err => {
            console.error('[Rime] Failed to play audio:', err);
            isPlayingRef.current = false;
            setSpeaking(false);
        });
    }, [setSpeaking]);

    // Interrupt current playback
    const interruptPlayback = useCallback(() => {
        // Stop current audio
        audioQueueRef.current.forEach(item => {
            item.audio.pause();
            URL.revokeObjectURL(item.url);
        });
        audioQueueRef.current = [];
        isPlayingRef.current = false;
        setSpeaking(false);
        setAudioLevel(0);

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    }, [setSpeaking]);

    const handleTranscript = useCallback(async (text: string) => {
        console.log('[Rime Pipeline] User said:', text);
        setTranscript(text);

        // Interrupt any ongoing playback when user speaks
        interruptPlayback();

        // Add to conversation history
        conversationRef.current.push({ role: 'user', content: text });

        try {
            setAgentInterimTranscript('Thinking...');

            // Transform tools to match OpenAI Chat API format
            const formattedTools = toolkitDefinitions.map(tool => ({
                type: 'function',
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters
                }
            }));

            // Send to OpenAI Chat API
            const response = await fetch('/api/chat/completion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: conversationRef.current,
                    tools: formattedTools,
                }),
            });

            if (!response.ok) {
                throw new Error(`Chat API error: ${response.status}`);
            }

            const data = await response.json();

            // Handle tool calls if any
            if (data.tool_calls && data.tool_calls.length > 0) {
                console.log('[Rime Pipeline] Executing tools:', data.tool_calls);

                for (const call of data.tool_calls) {
                    setAgentInterimTranscript(`Running ${call.function.name}...`);
                    
                    const toolResult = await runTool(
                        call.function.name,
                        JSON.parse(call.function.arguments)
                    );

                    // Add tool result to conversation
                    conversationRef.current.push({
                        role: 'assistant',
                        content: `Tool ${call.function.name} executed: ${JSON.stringify(toolResult)}`
                    });
                }

                // Get final response after tool execution
                const finalResponse = await fetch('/api/chat/completion', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: conversationRef.current,
                    }),
                });

                const finalData = await finalResponse.json();
                data.message = finalData.message;
            }

            const assistantMessage = data.message || 'I apologize, I didn\'t understand that.';
            conversationRef.current.push({ role: 'assistant', content: assistantMessage });

            setAgentTranscript(assistantMessage);
            setAgentInterimTranscript('');

            console.log('[Rime Pipeline] Assistant response:', assistantMessage);
            console.log('[Rime Pipeline] Using speaker:', rimeSpeakerId, 'model:', rimeModelId);

            // Send to Rime TTS with optimized settings
            const ttsResponse = await fetch('/api/tts/rime', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: assistantMessage,
                    speakerId: rimeSpeakerId,
                    modelId: rimeModelId,
                    reduceLatency: true
                }),
            });

            if (!ttsResponse.ok) {
                const errorData = await ttsResponse.json().catch(() => ({}));
                throw new Error(errorData.error || `Rime TTS error: ${ttsResponse.status}`);
            }

            const audioBlob = await ttsResponse.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            // Preload audio for faster playback
            audio.preload = 'auto';

            // Add to queue and play
            audioQueueRef.current.push({ audio, url: audioUrl });
            playNextAudio();

        } catch (error: any) {
            console.error('[Rime Pipeline] Error:', error);
            setError(error?.message || 'Failed to process request');
            setAgentInterimTranscript('');
            setSpeaking(false);
        }
    }, [rimeSpeakerId, rimeModelId, runTool, toolkitDefinitions, setTranscript, setAgentTranscript, setAgentInterimTranscript, setError, setSpeaking, playNextAudio, interruptPlayback]);

    const connect = useCallback(() => {
        if (!isSupported) {
            setError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
            return;
        }

        // Prevent multiple connections
        if (connected) {
            console.log('[Rime Pipeline] Already connected, ignoring duplicate connection request');
            return;
        }

        console.log('[Rime Pipeline] Connecting with Rime TTS...');
        console.log('[Rime Pipeline] Speaker:', rimeSpeakerId, 'Model:', rimeModelId);
        
        // Initialize audio context on connect (requires user gesture)
        initAudioContext();
        
        startListening(handleTranscript);
        setConnected(true);
        setListening(true);
    }, [startListening, handleTranscript, isSupported, setError, setListening, connected, rimeSpeakerId, rimeModelId, initAudioContext]);

    const disconnect = useCallback(() => {
        console.log('[Rime Pipeline] Disconnecting...');
        stopListening();
        
        // Clear audio queue
        audioQueueRef.current.forEach(item => {
            item.audio.pause();
            URL.revokeObjectURL(item.url);
        });
        audioQueueRef.current = [];
        isPlayingRef.current = false;
        
        // Cancel animation frame
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        
        setConnected(false);
        setListening(false);
        setSpeaking(false);
        setAudioLevel(0);
        conversationRef.current = conversationRef.current.slice(0, 1); // Keep system message only
    }, [stopListening, setListening, setSpeaking]);

    // Update interim transcript from speech recognition
    useEffect(() => {
        setInterimTranscript(speechInterim);
    }, [speechInterim, setInterimTranscript]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            audioQueueRef.current.forEach(item => {
                URL.revokeObjectURL(item.url);
            });
        };
    }, []);

    return {
        connect,
        disconnect,
        connected,
        isListening: speechIsListening,
        isSupported,
        remoteAudioElRef: { current: null }, // Dummy ref for compatibility
        audioLevel,
    };
};
