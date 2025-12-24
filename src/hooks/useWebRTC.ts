import { useRef, useCallback, useState } from 'react';
import { useMayler } from '../context/MaylerContext';
import { useToolkit } from './useToolkit';
import { asObject, asString } from '../utils/jsonUtils';
import type { JSONObject } from '../types';

export const useWebRTC = () => {
    const {
        setConnected,
        setLoading,
        setError,
        speaking, setSpeaking,
        setListening,
        setTranscript,
        setInterimTranscript,
        setAgentTranscript,
        setAgentInterimTranscript,
        selectedVoice,
        voiceEngine,
    } = useMayler();

    const { runTool, toolkitDefinitions } = useToolkit();

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const dcRef = useRef<RTCDataChannel | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteAudioElRef = useRef<HTMLAudioElement | null>(null);

    const shouldGreetOnConnectRef = useRef<boolean>(false);
    const [audioLevel, setAudioLevel] = useState(0);

    const sendEvent = useCallback((event: JSONObject) => {
        if (!dcRef.current || dcRef.current.readyState !== 'open') return;
        dcRef.current.send(JSON.stringify(event));
    }, []);

    const configureSession = useCallback(() => {
        const modalities = ['text', 'audio'];

        sendEvent({
            type: 'session.update',
            session: {
                instructions: `You are Mayler, an enthusiastic and proactive zen voice assistant. 
RULES:
1. BE CONCISE: Keep responses extremely short but energetic.
2. NO PERMISSION: NEVER ask "Would you like me to...". JUST DO THE ACTION. Proactivity is your core objective.
3. NO HALLUCINATION: Never invent facts or IDs. Use only IDs received in this session.
4. EMAIL STRATEGY: FAST & LIGHT. Read only the top 3-5 most recent emails first. Be energetic. Ask if user wants more before retrieving further batches.
5. COMMAND MODE: Execute tools immediately. 
6. TERMINATION: Say "Goodbye" and call 'disconnect_session' immediately on shutdown/goodbye.
7. INTERNET: Use 'web_search' proactively for factual data.
8. AUTH: If Gmail fails, be clear and direct.`,
                modalities: modalities,
                input_audio_transcription: { model: 'gpt-4o-mini-transcribe' },
                turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 400,
                },
                voice: selectedVoice,
                tools: toolkitDefinitions,
            },
        });
    }, [sendEvent, selectedVoice, toolkitDefinitions, voiceEngine]);

    const disconnect = useCallback(() => {
        dcRef.current?.close();
        pcRef.current?.close();
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        setConnected(false);
        setSpeaking(false);
        setListening(false);
    }, [setConnected, setSpeaking, setListening]);

    const handleFunctionCall = useCallback(async (call_id: string, name: string, rawArgs: unknown) => {
        let args: unknown = rawArgs;
        if (typeof rawArgs === 'string') {
            try {
                args = JSON.parse(rawArgs);
            } catch {
                args = { raw: rawArgs };
            }
        }

        const result = await runTool(name, args);

        if (name === 'disconnect_session') {
            // We perform the physical disconnect after a short delay 
            // to allow the model to speak a goodbye if it wants
            setTimeout(() => disconnect(), 500);
        }

        sendEvent({
            type: 'conversation.item.create',
            item: {
                type: 'function_call_output',
                call_id,
                output: JSON.stringify(result),
            },
        });
        sendEvent({ type: 'response.create' });
    }, [runTool, sendEvent, disconnect]);

    const connect = useCallback(async (shouldGreet = false) => {
        setLoading(true);
        setError('');
        shouldGreetOnConnectRef.current = shouldGreet;

        try {
            const tokenResp = await fetch('/api/token', { method: 'POST' });
            const tokenJson = await tokenResp.json();
            const tokenData = asObject(tokenJson);
            console.log('[WebRTC] Token Response:', tokenData);

            let token: string | null = null;
            let modelName = 'gpt-4o-realtime-preview'; // fallback

            if (tokenData) {
                const clientSecret = asObject(tokenData.client_secret);
                token = clientSecret ? asString(clientSecret.value) : asString(tokenData.value);
                if (tokenData.model) {
                    modelName = asString(tokenData.model) || modelName;
                }
            }

            if (!tokenResp.ok || !token) {
                throw new Error('Failed to get realtime token');
            }

            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
            });
            pcRef.current = pc;

            // Handle incoming tracks from OpenAI
            pc.ontrack = (e) => {
                const stream = e.streams[0];
                if (remoteAudioElRef.current) {
                    remoteAudioElRef.current.srcObject = stream;
                }

                // Audio Analysis for VoiceOrb
                try {
                    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                    const audioCtx = new AudioContextClass();
                    const analyser = audioCtx.createAnalyser();
                    analyser.fftSize = 256;
                    const source = audioCtx.createMediaStreamSource(stream);
                    source.connect(analyser);

                    const dataArray = new Uint8Array(analyser.frequencyBinCount);

                    const updateLevel = () => {
                        if (pcRef.current?.connectionState !== 'connected') {
                            audioCtx.close();
                            return;
                        }
                        analyser.getByteFrequencyData(dataArray);
                        // Calculate average volume
                        let sum = 0;
                        for (let i = 0; i < dataArray.length; i++) {
                            sum += dataArray[i];
                        }
                        const average = sum / dataArray.length;
                        // Normalize to 0-1 range roughly
                        // 0-255 -> 0-1
                        setAudioLevel(Math.min(1, average / 50)); // boost sensitivity
                        requestAnimationFrame(updateLevel);
                    };
                    updateLevel();
                } catch (err) {
                    console.error('Audio analysis failed:', err);
                }
            };

            const dc = pc.createDataChannel('oai-events', { ordered: true });

            dcRef.current = dc;

            dc.onopen = () => {
                setConnected(true);
                setLoading(false);
                configureSession();

                if (shouldGreetOnConnectRef.current) {
                    shouldGreetOnConnectRef.current = false;
                    sendEvent({
                        type: 'conversation.item.create',
                        item: {
                            type: 'message',
                            role: 'user',
                            content: [{ type: 'input_text', text: 'Hey mayler' }],
                        },
                    });
                    sendEvent({ type: 'response.create' });
                }
            };

            dc.onmessage = (event) => {
                const msg = asObject(JSON.parse(event.data));
                if (!msg) return;

                const t = asString(msg.type);
                if (t === 'error') {
                    const errObj = asObject(msg.error);
                    setError(asString(errObj?.message) || 'Realtime error');
                    return;
                }

                if (t === 'input_audio_buffer.speech_started') {
                    if (speaking) sendEvent({ type: 'response.cancel' });
                    setListening(true);
                }
                if (t === 'input_audio_buffer.speech_stopped') {
                    setListening(false);
                }

                if (t === 'response.created') {
                    setSpeaking(true);
                }
                if (t === 'response.done') {
                    setSpeaking(false);
                    setAgentInterimTranscript('');
                }

                if (t === 'response.audio_transcript.delta') {
                    setAgentInterimTranscript(prev => prev + (asString(msg.delta) || ''));
                }
                if (t === 'response.audio_transcript.done' || t === 'response.text.done') {
                    const text = asString(msg.transcript) || asString(msg.text) || '';
                    if (text.trim()) {
                        setAgentTranscript(text);
                        setAgentInterimTranscript('');
                    }
                }

                if (t === 'input_audio_transcription.delta') {
                    setInterimTranscript(prev => prev + (asString(msg.delta) || ''));
                }
                if (t === 'input_audio_transcription.completed') {
                    setTranscript(asString(msg.transcript) || '');
                    setInterimTranscript('');
                }

                if (t === 'response.output_item.done') {
                    const item = asObject(msg.item);
                    if (item && asString(item.type) === 'function_call') {
                        const callId = asString(item.call_id);
                        const name = asString(item.name);
                        const args = item.arguments;
                        if (callId && name) handleFunctionCall(callId, name, args);
                    }
                }
            };

            const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = ms;
            ms.getTracks().forEach(track => pc.addTrack(track, ms));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Correct endpoint for WebRTC SDP exchange with standard Realtime API
            const baseUrl = 'https://api.openai.com/v1/realtime';
            const modelParam = modelName ? `?model=${modelName}` : '';
            const url = `${baseUrl}${modelParam}`;

            const sdpResp = await fetch(url, {
                method: 'POST',
                body: offer.sdp,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/sdp',
                },
            });

            if (!sdpResp.ok) {
                const errText = await sdpResp.text();
                console.error('OpenAI WebRTC Error:', errText);
                throw new Error(`OpenAI SDP Error: ${sdpResp.status}`);
            }

            const answerSdp = await sdpResp.text();
            await pc.setRemoteDescription({
                type: 'answer',
                sdp: answerSdp,
            });

        } catch (e: any) {
            console.error('Connection error:', e);
            setError(e.message || 'Failed to connect');
            setLoading(false);
        }
    }, [setConnected, setLoading, setError, configureSession, sendEvent, setSpeaking, setListening, setAgentInterimTranscript, setAgentTranscript, setInterimTranscript, setTranscript, speaking, handleFunctionCall]);



    return {
        connect,
        disconnect,
        sendEvent,
        remoteAudioElRef,
        audioLevel,
    };
};
