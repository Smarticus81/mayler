/**
 * useLiveKit — LiveKit Agent Cloud voice pipeline hook.
 *
 * Provides an alternative to the direct OpenAI WebRTC pipeline, routing
 * audio through LiveKit's infrastructure for production-grade reliability,
 * adaptive interruption detection, and multi-modal capabilities.
 *
 * The LiveKit room connects to the Mayler Python agent worker which
 * handles STT → LLM → TTS (or OpenAI Realtime) with full tool access.
 */

import { useRef, useCallback, useState } from 'react';
import { useMayler } from '../context/MaylerContext';

interface LiveKitConnection {
    token: string;
    wsUrl: string;
    roomName: string;
    identity: string;
}

export const useLiveKit = () => {
    const {
        setConnected,
        setLoading,
        setError,
        setSpeaking,
        setListening,
        setTranscript,
        setInterimTranscript,
        setAgentTranscript,
        setAgentInterimTranscript,
        setIsWakeMode,
        addChatMessage,
    } = useMayler();

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteAudioElRef = useRef<HTMLAudioElement | null>(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const [lkConnected, setLkConnected] = useState(false);

    /**
     * Fetch a LiveKit token from the backend, which auto-dispatches
     * the Mayler voice agent to the room.
     */
    const fetchToken = useCallback(async (): Promise<LiveKitConnection> => {
        const resp = await fetch('/api/livekit/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: 'Token request failed' }));
            throw new Error(err.error || err.message || 'Failed to get LiveKit token');
        }

        return await resp.json();
    }, []);

    /**
     * Connect to LiveKit room using native WebRTC.
     * Uses the LiveKit signaling protocol via WebSocket, then establishes
     * a peer connection for audio/video streaming.
     */
    const connect = useCallback(async (shouldGreet = false) => {
        setLoading(true);
        setError('');

        try {
            const { token, wsUrl, roomName, identity } = await fetchToken();
            console.log(`[LiveKit] Connecting to room ${roomName} as ${identity}`);

            // Connect to LiveKit via WebSocket for signaling
            const signalUrl = `${wsUrl}/rtc?access_token=${encodeURIComponent(token)}&auto_subscribe=1&protocol=13`;
            const ws = new WebSocket(signalUrl);
            wsRef.current = ws;

            // Create peer connection with STUN/TURN
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                ],
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require',
            });
            pcRef.current = pc;

            // Handle incoming audio tracks from the agent
            pc.ontrack = (e) => {
                const stream = e.streams[0];
                if (!stream) return;

                if (e.track.kind === 'audio') {
                    if (remoteAudioElRef.current) {
                        remoteAudioElRef.current.srcObject = stream;
                    }

                    // Audio level analysis for VoiceOrb
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
                            setAudioLevel(Math.min(1, sum / dataArray.length / 50));
                            requestAnimationFrame(updateLevel);
                        };
                        updateLevel();
                    } catch (err) {
                        console.error('[LiveKit] Audio analysis failed:', err);
                    }
                }
            };

            // ICE candidate handling
            pc.onicecandidate = (e) => {
                if (e.candidate && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        case: 'trickle',
                        trickle: {
                            candidateInit: JSON.stringify(e.candidate),
                            target: 0, // PUBLISHER
                        },
                    }));
                }
            };

            // Connection state tracking
            pc.onconnectionstatechange = () => {
                const state = pc.connectionState;
                console.log(`[LiveKit] Connection state: ${state}`);
                if (state === 'connected') {
                    setConnected(true);
                    setLkConnected(true);
                    setLoading(false);
                } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                    setConnected(false);
                    setLkConnected(false);
                    setSpeaking(false);
                    setListening(false);
                }
            };

            // Get microphone
            const ms = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000,
                },
            });
            localStreamRef.current = ms;
            ms.getTracks().forEach(track => pc.addTrack(track, ms));

            // WebSocket signaling handler
            ws.onmessage = async (event) => {
                try {
                    const msg = JSON.parse(event.data);

                    if (msg.case === 'answer' || msg.answer) {
                        const answer = msg.answer || msg;
                        if (answer.sdp) {
                            await pc.setRemoteDescription({
                                type: 'answer',
                                sdp: answer.sdp,
                            });
                        }
                    }

                    if (msg.case === 'trickle' || msg.trickle) {
                        const trickle = msg.trickle || msg;
                        if (trickle.candidateInit) {
                            const candidate = JSON.parse(trickle.candidateInit);
                            await pc.addIceCandidate(candidate);
                        }
                    }

                    if (msg.case === 'offer' || msg.offer) {
                        const offer = msg.offer || msg;
                        if (offer.sdp) {
                            await pc.setRemoteDescription({
                                type: 'offer',
                                sdp: offer.sdp,
                            });
                            const answer = await pc.createAnswer();
                            await pc.setLocalDescription(answer);
                            ws.send(JSON.stringify({
                                case: 'answer',
                                answer: { sdp: answer.sdp, type: answer.type },
                            }));
                        }
                    }

                    // Handle data messages (transcripts, state updates)
                    if (msg.case === 'update') {
                        handleLiveKitUpdate(msg);
                    }
                } catch (err) {
                    console.error('[LiveKit] Signal message error:', err);
                }
            };

            ws.onopen = async () => {
                console.log('[LiveKit] WebSocket connected, creating offer...');

                // Create and send offer
                const offer = await pc.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true,
                });
                await pc.setLocalDescription(offer);

                ws.send(JSON.stringify({
                    case: 'offer',
                    offer: { sdp: offer.sdp, type: offer.type },
                    autoSubscribe: true,
                }));
            };

            ws.onclose = () => {
                console.log('[LiveKit] WebSocket closed');
            };

            ws.onerror = (err) => {
                console.error('[LiveKit] WebSocket error:', err);
                setError('LiveKit connection error');
                setLoading(false);
            };
        } catch (e: any) {
            console.error('[LiveKit] Connection error:', e);
            setError(e.message || 'Failed to connect to LiveKit');
            setLoading(false);
        }
    }, [setConnected, setLoading, setError, setSpeaking, setListening, fetchToken]);

    /**
     * Handle LiveKit room state updates (participant data, transcripts).
     */
    const handleLiveKitUpdate = useCallback((msg: any) => {
        // Agent speaking state from participant metadata
        if (msg.participants) {
            for (const p of msg.participants) {
                if (p.identity?.includes('agent') || p.name?.includes('mayler')) {
                    const meta = p.metadata ? JSON.parse(p.metadata) : {};
                    if (meta.speaking !== undefined) {
                        setSpeaking(meta.speaking);
                    }
                }
            }
        }

        // Transcription data
        if (msg.transcription) {
            const { text, isFinal, participantIdentity } = msg.transcription;
            const isAgent = participantIdentity?.includes('agent');

            if (isAgent) {
                if (isFinal) {
                    setAgentTranscript(text);
                    setAgentInterimTranscript('');
                    if (text?.trim()) addChatMessage('agent', text);
                } else {
                    setAgentInterimTranscript(text || '');
                }
            } else {
                if (isFinal) {
                    setTranscript(text);
                    setInterimTranscript('');
                    if (text?.trim()) addChatMessage('user', text);
                } else {
                    setInterimTranscript(text || '');
                }
            }
        }
    }, [setSpeaking, setAgentTranscript, setAgentInterimTranscript,
        setTranscript, setInterimTranscript, addChatMessage]);

    /**
     * Disconnect from LiveKit room.
     */
    const disconnect = useCallback(() => {
        wsRef.current?.close();
        pcRef.current?.close();
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        wsRef.current = null;
        pcRef.current = null;
        localStreamRef.current = null;
        setConnected(false);
        setLkConnected(false);
        setSpeaking(false);
        setListening(false);
    }, [setConnected, setSpeaking, setListening]);

    /**
     * Share screen for multi-modal — adds a video track that the
     * agent can see for visual understanding.
     */
    const shareScreen = useCallback(async () => {
        if (!pcRef.current) return;

        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: 5 }, // Low framerate for efficiency
                audio: false,
            });

            const videoTrack = screenStream.getVideoTracks()[0];
            pcRef.current.addTrack(videoTrack, screenStream);

            videoTrack.onended = () => {
                console.log('[LiveKit] Screen share ended');
            };

            console.log('[LiveKit] Screen share started');
        } catch (err) {
            console.error('[LiveKit] Screen share failed:', err);
        }
    }, []);

    /**
     * Share camera for multi-modal — agent can see what the camera sees.
     */
    const shareCamera = useCallback(async () => {
        if (!pcRef.current) return;

        try {
            const cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 10 },
                },
            });

            const videoTrack = cameraStream.getVideoTracks()[0];
            pcRef.current.addTrack(videoTrack, cameraStream);

            console.log('[LiveKit] Camera share started');
            return cameraStream;
        } catch (err) {
            console.error('[LiveKit] Camera share failed:', err);
            return null;
        }
    }, []);

    /**
     * Send a text message via data channel (for text-based interaction).
     */
    const sendTextMessage = useCallback((text: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({
            case: 'data',
            data: {
                kind: 'LOSSY',
                payload: btoa(JSON.stringify({ type: 'user_message', text })),
            },
        }));
    }, []);

    return {
        connect,
        disconnect,
        remoteAudioElRef,
        audioLevel,
        lkConnected,
        shareScreen,
        shareCamera,
        sendTextMessage,
    };
};
