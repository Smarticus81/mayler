import { useRef, useCallback, useState } from 'react';
import { useMayler } from '../context/MaylerContext';
import { useToolkit } from './useToolkit';
import { asObject, asString } from '../utils/jsonUtils';
import type { JSONObject } from '../types';

/**
 * OpenAI Realtime Voice Pipeline — WebRTC hook.
 * Implements the full spec: ephemeral tokens, data channel protocol,
 * tool call round-trip via /api/tools, interruption handling, and cleanup.
 */
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
        voiceSpeed,
        setIsWakeMode,
        setAppMode,
        setAgentState,
        addChatMessage,
    } = useMayler();

    const { toolkitDefinitions } = useToolkit();

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const dcRef = useRef<RTCDataChannel | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteAudioElRef = useRef<HTMLAudioElement | null>(null);

    const shouldGreetOnConnectRef = useRef<boolean>(false);
    const sessionIdRef = useRef<string | null>(null);
    const [audioLevel, setAudioLevel] = useState(0);

    // Use a ref to track speaking state for the dc.onmessage closure.
    const speakingRef = useRef(false);
    speakingRef.current = speaking;

    const sendEvent = useCallback((event: JSONObject) => {
        if (!dcRef.current || dcRef.current.readyState !== 'open') return;
        dcRef.current.send(JSON.stringify(event));
    }, []);

    const configureSession = useCallback(() => {
        sendEvent({
            type: 'session.update',
            session: {
                instructions: `You are Mayler, a professional email and productivity assistant.

CRITICAL SAFETY RULES:
1. NEVER send emails automatically — ONLY create drafts unless the user explicitly says "send it"
2. ONLY use email/draft IDs returned by tool responses — NEVER fabricate IDs
3. If a tool call returns an error or 404, SKIP that item and move on

GMAIL CONNECTION:
If the user asks to connect their email or any email tool returns "Gmail not authenticated":
1. Call check_gmail_connection to get the auth URL
2. Tell the user: "I have a link to connect your Gmail. You can open the settings panel and connect from there, or I can give you the direct link."
3. After they connect, continue normally.

EMAIL READING — PAGINATION WORKFLOW:
STEP 1: Call get_emails(maxResults=5) → returns emails + nextPageToken
STEP 2: Present subjects/senders to the user
STEP 3: For each email the user wants to hear, call get_email_by_id with the EXACT id
STEP 4: "Next email" = next in current list. Do NOT call get_emails again.
STEP 5: When ALL emails in current batch are done AND user wants more, call get_emails with pageToken from previous response.

KEY RULES:
- Keep track of which emails you've read from the current batch
- Only fetch a new page when current page is exhausted
- If get_email_by_id fails, skip it and try the next
- Always tell user which email number they're on (e.g., "Email 3 of 5")

EMAIL ACTIONS (use email IDs from get_emails/search_emails):
- Reply: reply_to_email — creates a threaded reply
- Forward: forward_email — forwards to another recipient
- Draft: create_draft — compose a new draft
- Star/Unstar: star_email, unstar_email
- Read/Unread: mark_email_read, mark_email_unread
- Archive: archive_email — removes from inbox, keeps in All Mail
- Delete: delete_email — moves to trash
- Important: mark_email_important
- Spam: mark_email_spam

Draft management: list_drafts, send_draft, update_draft, delete_draft

When user asks to reply, ask what they want to say, compose it, use reply_to_email.
When user asks to draft a new email, gather recipient/subject/body, then call create_draft.

SEARCH:
Use search_emails with Gmail query operators:
- "is:unread", "from:someone@gmail.com", "newer_than:1d"
- "has:attachment", "subject:invoice"

OTHER CAPABILITIES:
- Calendar: Create, list, update, delete events
- Web Search, Deep Search, Browsing
- Utilities: Weather, calculator, currency, translation, stocks, crypto

PERSONALITY:
- Professional, warm, and caring
- Concise — keep responses brief for voice (1-2 sentences)
- Proactive — when reading emails, keep going without asking "would you like me to continue?"
- Always respond in English

TERMINATION:
- "goodbye"/"bye" → Say farewell and STOP
- "shut down"/"stop listening" → Say "Shutting down" and STOP`,
                modalities: ['text', 'audio'],
                input_audio_transcription: { model: 'gpt-4o-transcribe' },
                turn_detection: {
                    type: 'server_vad',
                    threshold: 0.35,
                    prefix_padding_ms: 200,
                    silence_duration_ms: 400,
                    create_response: true,
                },
                temperature: 0.6,
                max_response_output_tokens: 4096,
                voice: selectedVoice,
                tools: toolkitDefinitions,
            },
        });
    }, [sendEvent, selectedVoice, toolkitDefinitions]);

    const disconnect = useCallback(() => {
        // 1. Stop all media tracks (mic)
        pcRef.current?.getSenders().forEach(sender => {
            sender.track?.stop();
        });
        localStreamRef.current?.getTracks().forEach(t => t.stop());

        // 2. Close data channel
        dcRef.current?.close();
        dcRef.current = null;

        // 3. Close peer connection
        pcRef.current?.close();
        pcRef.current = null;

        // 4. Clean up audio element
        if (remoteAudioElRef.current) {
            remoteAudioElRef.current.srcObject = null;
        }

        setConnected(false);
        setSpeaking(false);
        setListening(false);
        setAgentState('disconnected');
        sessionIdRef.current = null;
    }, [setConnected, setSpeaking, setListening, setAgentState]);

    /** Interrupt the agent (cancel current response) */
    const interrupt = useCallback(() => {
        if (dcRef.current?.readyState === 'open') {
            sendEvent({ type: 'response.cancel' });
        }
    }, [sendEvent]);

    /**
     * Tool call round-trip per spec:
     * 1. POST to /api/tools server endpoint
     * 2. Send tool result back via data channel
     * 3. Send response.create to trigger agent response
     */
    const handleFunctionCall = useCallback(async (call_id: string, name: string, rawArgs: unknown) => {
        console.log(`[WebRTC] Tool call: ${name}`, rawArgs);

        let args: unknown = rawArgs;
        if (typeof rawArgs === 'string') {
            try { args = JSON.parse(rawArgs); } catch { args = { raw: rawArgs }; }
        }

        try {
            // 1. POST to server-side tool execution endpoint
            const res = await fetch('/api/tools', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionIdRef.current || 'default',
                    tool_name: name,
                    arguments: args,
                }),
            });
            const data = await res.json();

            // 2. Send tool result back to OpenAI via data channel
            sendEvent({
                type: 'conversation.item.create',
                item: {
                    type: 'function_call_output',
                    call_id,
                    output: data.result ?? 'Tool execution failed',
                },
            });

            // 3. CRITICAL: Tell OpenAI to generate a response from the tool result
            sendEvent({ type: 'response.create' });

            // 4. Handle structured commands for client UI
            if (data.command) {
                if (data.command.type === 'disconnect') {
                    setTimeout(() => disconnect(), 2000);
                } else if (data.command.type === 'oauth' && data.command.authUrl) {
                    window.open(data.command.authUrl, 'Google Authentication', 'width=600,height=700');
                }
            }
        } catch (e: any) {
            // On error, still send a result so the agent can respond gracefully
            sendEvent({
                type: 'conversation.item.create',
                item: {
                    type: 'function_call_output',
                    call_id,
                    output: `Error: ${e.message}`,
                },
            });
            sendEvent({ type: 'response.create' });
        }
    }, [sendEvent, disconnect]);

    const connect = useCallback(async (shouldGreet = false) => {
        setLoading(true);
        setError('');
        setAgentState('connecting');
        shouldGreetOnConnectRef.current = shouldGreet;

        try {
            // ── Step 1: Get ephemeral token from server ──
            const tokenResp = await fetch('/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voice: selectedVoice, speed: voiceSpeed }),
            });
            const tokenJson = await tokenResp.json();
            const tokenData = asObject(tokenJson);

            let token: string | null = null;
            let modelName = 'gpt-4o-mini-realtime-preview-2024-12-17';

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

            // ── Step 2: Create RTCPeerConnection ──
            const pc = new RTCPeerConnection();
            pcRef.current = pc;

            // ── Step 3: Set up audio playback ──
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
                        let sum = 0;
                        for (let i = 0; i < dataArray.length; i++) {
                            sum += dataArray[i];
                        }
                        const average = sum / dataArray.length;
                        setAudioLevel(Math.min(1, average / 50));
                        requestAnimationFrame(updateLevel);
                    };
                    updateLevel();
                } catch (err) {
                    console.error('Audio analysis failed:', err);
                }
            };

            // ── Step 4: Add local microphone track ──
            // CRITICAL: echoCancellation prevents feedback loops
            const ms = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            localStreamRef.current = ms;
            ms.getTracks().forEach(track => pc.addTrack(track, ms));

            // ── Step 5: Create data channel for events ──
            const dc = pc.createDataChannel('oai-events', { ordered: true });
            dcRef.current = dc;

            dc.onopen = () => {
                setConnected(true);
                setLoading(false);
                setAgentState('listening');
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

            dc.onclose = () => {
                setAgentState('disconnected');
            };

            dc.onmessage = (event) => {
                const msg = asObject(JSON.parse(event.data));
                if (!msg) return;

                const t = asString(msg.type);

                switch (t) {
                    // ── Session lifecycle ──
                    case 'session.created':
                        sessionIdRef.current = asString(asObject(msg.session)?.id) || null;
                        setAgentState('listening');
                        break;

                    case 'session.updated':
                        // Acknowledgment — no action needed
                        break;

                    // ── Voice Activity Detection ──
                    case 'input_audio_buffer.speech_started':
                        // User started speaking — cancel if agent is speaking (interruption)
                        if (speakingRef.current) {
                            sendEvent({ type: 'response.cancel' });
                        }
                        setListening(true);
                        setAgentState('listening');
                        break;

                    case 'input_audio_buffer.speech_stopped':
                        setListening(false);
                        setAgentState('thinking');
                        break;

                    // ── Transcription ──
                    case 'response.audio_transcript.delta':
                        setAgentInterimTranscript(prev => prev + (asString(msg.delta) || ''));
                        break;

                    case 'conversation.item.input_audio_transcription.completed':
                    case 'input_audio_transcription.completed': {
                        const userText = asString(msg.transcript) || '';
                        setTranscript(userText);
                        setInterimTranscript('');
                        if (userText.trim()) addChatMessage('user', userText);
                        break;
                    }

                    case 'response.audio_transcript.done':
                    case 'response.text.done': {
                        const text = asString(msg.transcript) || asString(msg.text) || '';
                        if (text.trim()) {
                            setAgentTranscript(text);
                            setAgentInterimTranscript('');
                            addChatMessage('agent', text);

                            // Check for termination phrases in agent response
                            const lowerText = text.toLowerCase();
                            const isShutdown = lowerText.includes('shut down') || lowerText.includes('shutting down') || lowerText.includes('stop listening');
                            const isGoodbye = lowerText.includes('goodbye') || lowerText.includes('bye') || lowerText.includes("that's all");

                            if (isShutdown) {
                                setTimeout(() => {
                                    disconnect();
                                    setIsWakeMode(false);
                                    setAppMode('shutdown');
                                }, 2000);
                            } else if (isGoodbye) {
                                setTimeout(() => {
                                    disconnect();
                                    setIsWakeMode(true);
                                    setAppMode('wake_word');
                                }, 2000);
                            }
                        }
                        break;
                    }

                    // ── Audio playback ──
                    case 'response.audio.delta':
                        setSpeaking(true);
                        setAgentState('speaking');
                        break;

                    // ── Response lifecycle ──
                    case 'response.done':
                        setSpeaking(false);
                        setAgentInterimTranscript('');
                        setAgentState('listening');
                        break;

                    // ── Tool calls ──
                    case 'response.function_call_arguments.done': {
                        const toolName = asString(msg.name);
                        const callId = asString(msg.call_id);
                        const args = msg.arguments;
                        if (callId && toolName) handleFunctionCall(callId, toolName, args);
                        break;
                    }

                    case 'response.output_item.done': {
                        const item = asObject(msg.item);
                        if (item && asString(item.type) === 'function_call') {
                            const callId = asString(item.call_id);
                            const name = asString(item.name);
                            const args = item.arguments;
                            if (callId && name) handleFunctionCall(callId, name, args);
                        }
                        break;
                    }

                    case 'input_audio_transcription.delta':
                        setInterimTranscript(prev => prev + (asString(msg.delta) || ''));
                        break;

                    // ── Errors ──
                    case 'error': {
                        const errObj = asObject(msg.error);
                        const errMsg = asString(errObj?.message) || 'Realtime error';
                        // Non-fatal errors
                        if (errMsg.toLowerCase().includes('cancellation failed') ||
                            errMsg.toLowerCase().includes('no active response')) {
                            console.warn('[WebRTC] Non-fatal:', errMsg);
                            return;
                        }
                        setError(errMsg);
                        setAgentState('error');
                        break;
                    }
                }
            };

            // ── Step 6: Create SDP offer ──
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // ── Step 7: Send offer to OpenAI, get SDP answer ──
            const sdpResp = await fetch(
                `https://api.openai.com/v1/realtime?model=${modelName}`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/sdp',
                    },
                    body: offer.sdp,
                },
            );

            if (!sdpResp.ok) {
                const errText = await sdpResp.text();
                console.error('OpenAI WebRTC Error:', errText);
                throw new Error(`OpenAI SDP Error: ${sdpResp.status}`);
            }

            const answerSdp = await sdpResp.text();
            await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

        } catch (e: any) {
            console.error('Connection error:', e);
            setError(e.message || 'Failed to connect');
            setLoading(false);
            setAgentState('error');
        }
    }, [setConnected, setLoading, setError, setAgentState, configureSession, sendEvent, setSpeaking, setListening, setAgentInterimTranscript, setAgentTranscript, setInterimTranscript, setTranscript, handleFunctionCall, disconnect, setIsWakeMode, setAppMode, selectedVoice, voiceSpeed, addChatMessage]);

    return {
        connect,
        disconnect,
        interrupt,
        sendEvent,
        remoteAudioElRef,
        audioLevel,
    };
};
