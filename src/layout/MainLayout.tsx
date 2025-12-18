import React, { useState } from 'react';
import { useMayler } from '../context/MaylerContext';
import { useAudio } from '../hooks/useAudio';
import { useWakeWord } from '../hooks/useWakeWord';
import { useWebRTC } from '../hooks/useWebRTC';
import { VoiceOrb } from '../components/VoiceOrb';
import { TranscriptStream } from '../components/TranscriptStream';
import { SettingsModal } from '../components/SettingsModal';
import { BrandHeader } from '../components/BrandHeader';

export const MainLayout: React.FC = () => {
    const { connected, setShowSettings, error } = useMayler();
    const { playWakeChime } = useAudio();
    const { connect, disconnect, remoteAudioElRef } = useWebRTC();
    const [audioLevel] = useState(0);

    // Initialize wake word detection
    useWakeWord(
        () => {
            console.log('Wake word detected! Connecting...');
            connect(true); // Connect and greet
        },
        playWakeChime
    );

    return (
        <div className="mayler-container">
            <div className="ambient-bg" />
            <div className="glass-overlay" />

            <audio ref={remoteAudioElRef} autoPlay />

            <div className="status-bar">
                <div style={{ flex: 1 }} />
                <button className="settings-btn" onClick={() => setShowSettings(true)}>
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

                {!connected && (
                    <div className="status-hint">
                        Say "Hey Mayler" to start
                    </div>
                )}
            </main>

            <SettingsModal />

            {connected && (
                <div className="controls">
                    <button className="primary-btn pulse" onClick={disconnect}>
                        Disconnect
                    </button>
                </div>
            )}
        </div>
    );
};
