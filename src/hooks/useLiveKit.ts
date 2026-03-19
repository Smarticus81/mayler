/**
 * useLiveKit — LiveKit Agent Cloud voice pipeline hook.
 *
 * Uses the official livekit-client SDK for proper signaling (protobuf)
 * and media handling. Connects to a LiveKit room where the Mayler
 * Python agent worker handles STT → LLM → TTS with full tool access.
 */

import { useRef, useCallback, useState } from 'react';
import {
    Room,
    RoomEvent,
    Track,
    ConnectionState,
} from 'livekit-client';
import type {
    RemoteTrack,
    RemoteTrackPublication,
    RemoteParticipant,
    TranscriptionSegment,
    Participant,
} from 'livekit-client';
import { useMayler } from '../context/MaylerContext';

/** Seconds to wait for an agent to join before falling back to OpenAI */
const AGENT_JOIN_TIMEOUT = 15;

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
        addChatMessage,
        setVoicePipeline,
    } = useMayler();

    const roomRef = useRef<Room | null>(null);
    const agentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const agentJoinedRef = useRef(false);
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
     * Connect to LiveKit room using the official SDK.
     */
    const connect = useCallback(async (_shouldGreet = false) => {
        setLoading(true);
        setError('');

        try {
            const { token, wsUrl, roomName, identity } = await fetchToken();
            console.log(`[LiveKit] Connecting to room ${roomName} as ${identity}`);

            const room = new Room({
                adaptiveStream: true,
                dynacast: true,
                audioCaptureDefaults: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            roomRef.current = room;

            // Track subscribed — handle incoming audio from the agent
            room.on(RoomEvent.TrackSubscribed, (
                track: RemoteTrack,
                _publication: RemoteTrackPublication,
                participant: RemoteParticipant,
            ) => {
                console.log(`[LiveKit] Track subscribed: ${track.kind} from ${participant.identity}`);

                if (track.kind === Track.Kind.Audio) {
                    // Attach audio to the hidden audio element for playback
                    const el = track.attach();
                    el.style.display = 'none';
                    document.body.appendChild(el);

                    // Audio level monitoring for VoiceOrb
                    try {
                        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                        const audioCtx = new AudioContextClass();
                        const analyser = audioCtx.createAnalyser();
                        analyser.fftSize = 256;
                        const source = audioCtx.createMediaStreamSource(
                            new MediaStream([track.mediaStreamTrack])
                        );
                        source.connect(analyser);
                        const dataArray = new Uint8Array(analyser.frequencyBinCount);

                        const updateLevel = () => {
                            if (room.state !== ConnectionState.Connected) {
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
            });

            // Track unsubscribed — clean up
            room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
                track.detach().forEach(el => el.remove());
            });

            // Connection state changes
            room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
                console.log(`[LiveKit] Connection state: ${state}`);
                if (state === ConnectionState.Connected) {
                    setConnected(true);
                    setLkConnected(true);
                    setLoading(false);
                    setListening(true);
                } else if (state === ConnectionState.Disconnected) {
                    setConnected(false);
                    setLkConnected(false);
                    setSpeaking(false);
                    setListening(false);
                }
            });

            // Agent speaking state via active speaker changes
            room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
                const agentSpeaking = speakers.some(
                    s => s.identity?.includes('agent') || s.name?.includes('mayler')
                );
                setSpeaking(agentSpeaking);
            });

            // Transcription events from the agent
            room.on(RoomEvent.TranscriptionReceived, (
                segments: TranscriptionSegment[],
                participant?: Participant,
            ) => {
                const isAgent = participant?.identity?.includes('agent')
                    || participant?.name?.includes('mayler');

                for (const seg of segments) {
                    if (isAgent) {
                        if (seg.final) {
                            setAgentTranscript(seg.text);
                            setAgentInterimTranscript('');
                            if (seg.text?.trim()) addChatMessage('agent', seg.text);
                        } else {
                            setAgentInterimTranscript(seg.text || '');
                        }
                    } else {
                        if (seg.final) {
                            setTranscript(seg.text);
                            setInterimTranscript('');
                            if (seg.text?.trim()) addChatMessage('user', seg.text);
                        } else {
                            setInterimTranscript(seg.text || '');
                        }
                    }
                }
            });

            room.on(RoomEvent.Disconnected, () => {
                console.log('[LiveKit] Disconnected');
                setConnected(false);
                setLkConnected(false);
            });

            // Detect when agent joins
            agentJoinedRef.current = false;
            room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
                console.log(`[LiveKit] Participant joined: ${participant.identity}`);
                if (participant.identity?.includes('agent') || participant.name?.includes('mayler')) {
                    agentJoinedRef.current = true;
                    if (agentTimerRef.current) {
                        clearTimeout(agentTimerRef.current);
                        agentTimerRef.current = null;
                    }
                    console.log('[LiveKit] Agent joined the room');
                }
            });

            // Connect to the room and publish microphone
            await room.connect(wsUrl, token);
            console.log('[LiveKit] Connected to room');

            // Check if agent is already in the room
            for (const [, p] of room.remoteParticipants) {
                if (p.identity?.includes('agent') || p.name?.includes('mayler')) {
                    agentJoinedRef.current = true;
                    console.log('[LiveKit] Agent already in room');
                    break;
                }
            }

            // Start agent join timeout — fall back to OpenAI if no agent appears
            if (!agentJoinedRef.current) {
                agentTimerRef.current = setTimeout(() => {
                    if (!agentJoinedRef.current && roomRef.current) {
                        console.warn(`[LiveKit] No agent joined within ${AGENT_JOIN_TIMEOUT}s — falling back to OpenAI WebRTC`);
                        roomRef.current.disconnect();
                        roomRef.current = null;
                        setConnected(false);
                        setLkConnected(false);
                        setLoading(false);
                        setError('LiveKit agent unavailable — switching to OpenAI pipeline');
                        setVoicePipeline('openai-webrtc');
                    }
                }, AGENT_JOIN_TIMEOUT * 1000);
            }

            await room.localParticipant.setMicrophoneEnabled(true);
            console.log('[LiveKit] Microphone enabled');

        } catch (e: any) {
            console.error('[LiveKit] Connection error:', e);
            setError(e.message || 'Failed to connect to LiveKit');
            setLoading(false);
        }
    }, [setConnected, setLoading, setError, setSpeaking, setListening, fetchToken,
        setTranscript, setInterimTranscript, setAgentTranscript, setAgentInterimTranscript,
        addChatMessage, setVoicePipeline]);

    /**
     * Disconnect from LiveKit room.
     */
    const disconnect = useCallback(() => {
        if (agentTimerRef.current) {
            clearTimeout(agentTimerRef.current);
            agentTimerRef.current = null;
        }
        roomRef.current?.disconnect();
        roomRef.current = null;
        setConnected(false);
        setLkConnected(false);
        setSpeaking(false);
        setListening(false);
        setAudioLevel(0);
    }, [setConnected, setSpeaking, setListening]);

    /**
     * Share screen for multi-modal — adds a video track that the
     * agent can see for visual understanding.
     */
    const shareScreen = useCallback(async () => {
        if (!roomRef.current) return;
        try {
            await roomRef.current.localParticipant.setScreenShareEnabled(true);
            console.log('[LiveKit] Screen share started');
        } catch (err) {
            console.error('[LiveKit] Screen share failed:', err);
        }
    }, []);

    /**
     * Share camera for multi-modal — agent can see what the camera sees.
     */
    const shareCamera = useCallback(async () => {
        if (!roomRef.current) return;
        try {
            await roomRef.current.localParticipant.setCameraEnabled(true);
            console.log('[LiveKit] Camera share started');
        } catch (err) {
            console.error('[LiveKit] Camera share failed:', err);
            return null;
        }
    }, []);

    /**
     * Send a text message via data channel (for text-based interaction).
     */
    const sendTextMessage = useCallback((text: string) => {
        if (!roomRef.current) return;
        const encoder = new TextEncoder();
        const payload = encoder.encode(JSON.stringify({ type: 'user_message', text }));
        roomRef.current.localParticipant.publishData(payload, { reliable: true });
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
