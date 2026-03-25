import React, { useRef, useEffect, useCallback } from 'react';
import { useMayler } from '../context/MaylerContext';
import { useAudio } from '../hooks/useAudio';
import { useWakeWord } from '../hooks/useWakeWord';
import { useWebRTC } from '../hooks/useWebRTC';
import { useLiveKit } from '../hooks/useLiveKit';
import { useGreeting } from '../hooks/useGreeting';
import { VoiceOrb } from '../components/VoiceOrb';
import { TranscriptStream } from '../components/TranscriptStream';
import { SettingsModal } from '../components/SettingsModal';
import { BrandHeader } from '../components/BrandHeader';

/**
 * Main layout implementing the App State Machine per OpenAI Voice Pipeline spec:
 *
 *   [idle] → tap → [wake_word] → wake detected → [command] → goodbye → [wake_word]
 *                                                           → shutdown → [shutdown] → tap → [wake_word]
 */
export const MainLayout: React.FC = () => {
    const {
        connected, setShowSettings, error, loading, voicePipeline,
        appMode, setAppMode, agentState, setIsWakeMode,
    } = useMayler();

    // Both pipelines are initialized; only the active one is used
    const openaiPipeline = useWebRTC();
    const livekitPipeline = useLiveKit();

    const isLiveKit = voicePipeline === 'livekit-cloud';
    const activePipeline = isLiveKit ? livekitPipeline : openaiPipeline;
    const { connect, disconnect, audioLevel } = activePipeline;

    // Use a stable audio ref shared across both pipelines
    const sharedAudioRef = useRef<HTMLAudioElement | null>(null);
    useEffect(() => {
        openaiPipeline.remoteAudioElRef.current = sharedAudioRef.current;
        livekitPipeline.remoteAudioElRef.current = sharedAudioRef.current;
    });

    const { initAudioContext, soundWake, soundSleep, soundError } = useAudio();
    const { playGreeting, isReady } = useGreeting();

    // Auto-connect via OpenAI when LiveKit falls back
    const prevPipelineRef = useRef(voicePipeline);
    useEffect(() => {
        if (prevPipelineRef.current === 'livekit-cloud' && voicePipeline === 'openai-webrtc' && appMode === 'command' && !connected) {
            console.log('[Fallback] LiveKit → OpenAI WebRTC, auto-connecting...');
            openaiPipeline.connect(true);
        }
        prevPipelineRef.current = voicePipeline;
    }, [voicePipeline, appMode, connected, openaiPipeline]);

    /**
     * State machine tap handler per spec:
     * idle/shutdown → wake_word (activate)
     * wake_word → command (skip wake word, connect directly)
     * command + speaking → interrupt
     * command + not speaking → wake_word (disconnect)
     */
    const handleTap = useCallback(async () => {
        if (appMode === 'idle' || appMode === 'shutdown') {
            // Request mic permission + activate
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch { /* user will see permission dialog */ }
            initAudioContext();
            soundWake();
            setAppMode('wake_word');
            setIsWakeMode(true);
        } else if (appMode === 'wake_word') {
            // Skip wake word detection — connect directly
            soundWake();
            setAppMode('command');
            setIsWakeMode(false);
            connect(true);
        } else if (appMode === 'command') {
            if (agentState === 'speaking' && 'interrupt' in activePipeline) {
                // Tap while speaking = interrupt
                (activePipeline as any).interrupt();
            } else {
                // Tap while not speaking = disconnect, return to wake_word
                soundSleep();
                disconnect();
                setAppMode('wake_word');
                setIsWakeMode(true);
            }
        }
    }, [appMode, agentState, activePipeline, initAudioContext, soundWake, soundSleep, setAppMode, setIsWakeMode, connect, disconnect]);

    // Wake word callbacks
    const onWakeWordDetected = useCallback(() => {
        if (appMode !== 'wake_word') return;
        console.log('[MainLayout] Wake word detected! Connecting...');
        setAppMode('command');
        setIsWakeMode(false);
        if (isReady) playGreeting();
        connect(true);
    }, [appMode, setAppMode, setIsWakeMode, connect, isReady, playGreeting]);

    const onStopDetected = useCallback(() => {
        console.log('[MainLayout] Stop phrase detected — returning to wake_word');
        if (connected) {
            disconnect();
        }
        soundSleep();
        setAppMode('wake_word');
        setIsWakeMode(true);
    }, [connected, disconnect, soundSleep, setAppMode, setIsWakeMode]);

    const onShutdownDetected = useCallback(() => {
        console.log('[MainLayout] Shutdown phrase detected');
        if (connected) {
            disconnect();
        }
        soundSleep();
        setAppMode('shutdown');
        setIsWakeMode(false);
    }, [connected, disconnect, soundSleep, setAppMode, setIsWakeMode]);

    const onChime = useCallback(() => {
        soundWake();
    }, [soundWake]);

    useWakeWord({
        onWakeWordDetected,
        onStopDetected,
        onShutdownDetected,
        onChime,
        isActive: appMode === 'wake_word' && !connected,
    });

    // Play error sound when error occurs
    useEffect(() => {
        if (error) soundError();
    }, [error, soundError]);

    return (
        <div className="mayler-container">
            <div className="ambient-bg" />
            <div className="glass-overlay" />

            <audio ref={sharedAudioRef} autoPlay />

            <div className="status-bar">
                {connected && isLiveKit && (
                    <div className="livekit-controls">
                        <button
                            className="lk-btn"
                            onClick={() => livekitPipeline.shareScreen()}
                            title="Share screen for visual analysis"
                            aria-label="Share Screen"
                        >
                            <svg viewBox="0 0 24 24" width="16" height="16">
                                <path fill="currentColor" d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
                            </svg>
                        </button>
                        <button
                            className="lk-btn"
                            onClick={() => livekitPipeline.shareCamera()}
                            title="Share camera for visual analysis"
                            aria-label="Share Camera"
                        >
                            <svg viewBox="0 0 24 24" width="16" height="16">
                                <path fill="currentColor" d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                            </svg>
                        </button>
                    </div>
                )}
                <div style={{ flex: 1 }} />
                {connected && (
                    <span className="pipeline-badge">
                        {isLiveKit ? 'LiveKit' : 'OpenAI'}
                    </span>
                )}
                <button className="settings-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
                    <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5A3.5 3.5 0 0 1 15.5 12A3.5 3.5 0 0 1 12 15.5M19.43 12.97c0-.32.07-.66.07-1.03s-.07-.71-.07-1.03l2.11-1.63c.18-.15.24-.41.12-.61l-2-3.46c-.12-.22-.39-.29-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 1h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.07-.49 0-.61.22l-2 3.46c-.12.2-.06.46.12.61l2.11 1.63c-.04.32-.07.65-.07 1.03s.03.71.07 1.03l-2.11 1.63c-.18.15-.24.41-.12.61l2 3.46c.12.22.39.29.61.22l2.49-1c.52.39 1.06.73 1.69.98l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.25 1.17-.59 1.69-.98l2.49 1c.22.07.49 0 .61-.22l2-3.46c.12-.2.06-.46-.12-.61l-2.11-1.63Z" />
                    </svg>
                </button>
            </div>

            <main className="main-content">
                <BrandHeader />

                <VoiceOrb audioLevel={audioLevel} />

                {error && <div className="error-banner">{error}</div>}

                <TranscriptStream />

                {appMode === 'idle' && (
                    <div className="status-hint">
                        <button className="primary-btn pulse" onClick={handleTap}>
                            Activate Mayler
                        </button>
                    </div>
                )}

                {appMode === 'shutdown' && (
                    <div className="status-hint">
                        <button className="primary-btn" onClick={handleTap}>
                            Reactivate Mayler
                        </button>
                    </div>
                )}

                {appMode === 'wake_word' && !connected && !loading && (
                    <div className="status-hint" onClick={handleTap} style={{ cursor: 'pointer' }}>
                        Say "Hey Mayler" or tap to start
                    </div>
                )}

                {loading && (
                    <div className="status-hint">
                        Connecting{isLiveKit ? ' via LiveKit' : ''}...
                    </div>
                )}
            </main>

            <SettingsModal />

            {connected && (
                <div className="controls">
                    <button className="primary-btn disconnect" onClick={handleTap}>
                        {agentState === 'speaking' ? 'Interrupt' : 'Disconnect'}
                    </button>
                </div>
            )}
        </div>
    );
};
