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
        setIsWakeMode,
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
                instructions: `You are Mayler, a professional email assistant.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL SAFETY RULES - NEVER VIOLATE THESE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. NEVER send emails automatically - ONLY create drafts
2. NEVER use send_email or reply_to_email - they are DISABLED
3. ONLY use email IDs that appear in tool responses
4. NEVER guess, fabricate, or modify email IDs
5. If an ID doesn't work, STOP - don't try similar IDs
6. Process emails continuously WITHOUT asking permission
7. NEVER ask "would you like me to continue" or "anything else"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMAIL WORKFLOW:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Call get_emails - returns metadata with 'id' field
2. For each email in the response:
   - Call get_email_by_id with EXACT id from step 1
   - If it fails (404), SKIP IT - don't try other IDs
   - Process the email content
   - Move to next email automatically
3. ⚠️ WHEN BATCH IS EXHAUSTED: Call get_emails AGAIN for next batch
4. Repeat until all emails processed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL: NEXT BATCH RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When you finish processing ALL emails in a batch:
- IMMEDIATELY call get_emails again to fetch the next batch
- NEVER try to guess or fabricate new email IDs
- NEVER increment/modify IDs from previous batch
- The ONLY way to get more emails is: call get_emails

If user wants more emails → call get_emails
If batch is done → call get_emails
If you need new IDs → call get_emails

EXAMPLE - CORRECT:
get_emails → [{id: "19b6a88c857268d9", ...}, {id: "19b6a6c62648ba28", ...}]
get_email_by_id(emailId: "19b6a88c857268d9") ✅
get_email_by_id(emailId: "19b6a6c62648ba28") ✅
→ Batch done! Call get_emails again for next batch ✅

EXAMPLE - WRONG:
get_emails → [{id: "19b6a88c857268d9", ...}]
→ Batch done, trying to continue with made-up IDs:
get_email_by_id(emailId: "19b6a88c857268d8") ❌ FABRICATED!
get_email_by_id(emailId: "19b6a88c857268d7") ❌ FABRICATED!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPOSING EMAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- ALWAYS use create_draft (never send_email or reply_to_email)
- Draft will be saved for user to review and send manually
- Tell user "I've created a draft for you to review"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERSONALITY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Professional, warm, caring
- Enthusiastic and proactive
- Process emails continuously
- NEVER ask permission to continue
- NEVER say "anything else" or "would you like me to"
- Just move to next email automatically

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TERMINATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- "goodbye"/"bye" → Say farewell and STOP
- "shut down"/"stop listening" → Say "Shutting down" and STOP`,
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
        // ═══════════════════════════════════════════════════════════════════
        // 📡 AGENT FUNCTION CALL RECEIVED
        // ═══════════════════════════════════════════════════════════════════
        console.log(`\n%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'color: #a78bfa');
        console.log(`%c📡 AGENT FUNCTION CALL RECEIVED`, 'color: #a78bfa; font-weight: bold; font-size: 14px');
        console.log(`%cCall ID: ${call_id}`, 'color: #94a3b8');
        console.log(`%cFunction: ${name}`, 'color: #fbbf24; font-weight: bold');
        console.log(`%cRaw Arguments:`, 'color: #94a3b8');
        console.log(rawArgs);
        console.log(`%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`, 'color: #a78bfa');

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

                        // Check for termination phrases
                        const lowerText = text.toLowerCase();
                        const isGoodbye = lowerText.includes('goodbye') || lowerText.includes('bye') || lowerText.includes("that's all");
                        const isShutdown = lowerText.includes('shut down') || lowerText.includes('shutting down') || lowerText.includes('stop listening');

                        if (isShutdown) {
                            // Complete shutdown - disable wake word
                            console.log('🛑 Shutdown detected - disabling wake word');
                            setTimeout(() => {
                                disconnect();
                                setIsWakeMode(false);
                            }, 1500); // Give time for farewell to play
                        } else if (isGoodbye) {
                            // Return to wake word mode
                            console.log('👋 Goodbye detected - returning to wake word mode');
                            setTimeout(() => {
                                disconnect();
                                setIsWakeMode(true);
                            }, 1500); // Give time for farewell to play
                        }
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
