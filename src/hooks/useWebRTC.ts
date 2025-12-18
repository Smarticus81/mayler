import { useRef, useCallback } from 'react';
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
    } = useMayler();

    const { runTool, toolkitDefinitions } = useToolkit();

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const dcRef = useRef<RTCDataChannel | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteAudioElRef = useRef<HTMLAudioElement | null>(null);

    const shouldGreetOnConnectRef = useRef<boolean>(false);

    const sendEvent = useCallback((event: JSONObject) => {
        if (!dcRef.current || dcRef.current.readyState !== 'open') return;
        dcRef.current.send(JSON.stringify(event));
    }, []);

    const configureSession = useCallback(() => {
        sendEvent({
            type: 'session.update',
            session: {
                type: 'realtime',
                instructions: `You are mayler, a laid-back but professional AI assistant.`,
                output_modalities: ['audio'],
                audio: {
                    input: {
                        transcription: { model: 'gpt-4o-mini-transcribe' },
                        turn_detection: {
                            type: 'server_vad',
                            threshold: 0.4,
                            prefix_padding_ms: 200,
                            silence_duration_ms: 400,
                        },
                    },
                    output: {
                        voice: selectedVoice,
                    },
                },
                tools: toolkitDefinitions,
            },
        });
    }, [sendEvent, selectedVoice, toolkitDefinitions]);

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

        sendEvent({
            type: 'conversation.item.create',
            item: {
                type: 'function_call_output',
                call_id,
                output: JSON.stringify(result),
            },
        });
        sendEvent({ type: 'response.create' });
    }, [runTool, sendEvent]);

    const connect = useCallback(async (shouldGreet = false) => {
        setLoading(true);
        setError('');
        shouldGreetOnConnectRef.current = shouldGreet;

        try {
            const tokenResp = await fetch('/api/token', { method: 'POST' });
            const tokenJson = await tokenResp.json();
            const tokenData = asObject(tokenJson);

            let token: string | null = null;
            if (tokenData) {
                const clientSecret = asObject(tokenData.client_secret);
                token = clientSecret ? asString(clientSecret.value) : asString(tokenData.value);
            }

            if (!tokenResp.ok || !token) {
                throw new Error('Failed to get realtime token');
            }

            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
            });
            pcRef.current = pc;

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
                if (t === 'response.audio_transcript.done') {
                    setAgentTranscript(asString(msg.transcript) || '');
                    setAgentInterimTranscript('');
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
            pc.addTrack(ms.getTracks()[0]);

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const baseUrl = 'https://api.openai.com/v1/realtime';
            const model = 'gpt-4o-realtime-preview-2024-12-17';
            const sdpResp = await fetch(`${baseUrl}?model=${model}`, {
                method: 'POST',
                body: offer.sdp,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/sdp',
                },
            });

            await pc.setRemoteDescription({
                type: 'answer',
                sdp: await sdpResp.text(),
            });

        } catch (e: any) {
            console.error('Connection error:', e);
            setError(e.message || 'Failed to connect');
            setLoading(false);
        }
    }, [setConnected, setLoading, setError, configureSession, sendEvent, setSpeaking, setListening, setAgentInterimTranscript, setAgentTranscript, setInterimTranscript, setTranscript, speaking, handleFunctionCall]);

    const disconnect = useCallback(() => {
        dcRef.current?.close();
        pcRef.current?.close();
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        setConnected(false);
        setSpeaking(false);
        setListening(false);
    }, [setConnected, setSpeaking, setListening]);

    return {
        connect,
        disconnect,
        sendEvent,
        remoteAudioElRef,
    };
};
