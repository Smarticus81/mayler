import React from 'react';
import { useMayler } from '../context/MaylerContext';
import { useAuth } from '../hooks/useAuth';
import type { VoiceOption } from '../types';

export const SettingsModal: React.FC = () => {
    const {
        showSettings, setShowSettings,
        wakeWordEnabled, setWakeWordEnabled,
        googleStatus,
        selectedVoice, setSelectedVoice,
    } = useMayler();

    const { triggerGoogleAuth } = useAuth();

    if (!showSettings) return null;

    const voices: Array<VoiceOption> =
        ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];

    return (
        <div className="settings-panel" onClick={() => setShowSettings(false)}>
            <div className="settings-content" onClick={(e) => e.stopPropagation()}>
                <div className="settings-header">
                    <h2>Settings</h2>
                </div>

                <div className="settings-sections">
                    <div className="setting-section">
                        <h3>Voice Choice</h3>
                        <div className="voice-grid">
                            {voices.map((voice) => (
                                <button
                                    key={voice}
                                    className={`voice-btn ${selectedVoice === voice ? 'active' : ''}`}
                                    onClick={() => setSelectedVoice(voice)}
                                >
                                    {voice.charAt(0).toUpperCase() + voice.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="setting-section">
                        <h3>Recognition</h3>
                        <div className="setting-item">
                            <div className="setting-info">
                                <label>Wake Word</label>
                                <span className="setting-description">Listen for "Hey Mayler"</span>
                            </div>
                            <button
                                className={`toggle-btn ${wakeWordEnabled ? 'active' : ''}`}
                                onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
                            >
                                {wakeWordEnabled ? 'On' : 'Off'}
                            </button>
                        </div>
                    </div>

                    <div className="setting-section">
                        <h3>Integrations</h3>
                        <div className="setting-item">
                            <div className="setting-info">
                                <label>Google Account</label>
                                <span className="setting-description">Gmail and Calendar access</span>
                            </div>
                            <button
                                className={`toggle-btn ${googleStatus === 'available' ? 'active' : ''}`}
                                onClick={triggerGoogleAuth}
                            >
                                {googleStatus === 'available' ? 'Connected' : 'Connect'}
                            </button>
                        </div>
                    </div>
                </div>

                <button className="close-settings" onClick={() => setShowSettings(false)}>
                    Done
                </button>
            </div>
        </div>
    );
};
