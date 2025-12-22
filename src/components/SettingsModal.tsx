import React from 'react';
import { useMayler } from '../context/MaylerContext';
import { useAuth } from '../hooks/useAuth';

export const SettingsModal: React.FC = () => {
    const {
        showSettings, setShowSettings,
        wakeWordEnabled, setWakeWordEnabled,
        googleStatus,
        selectedVoice, setSelectedVoice,
        voiceEngine, setVoiceEngine,

        rimeSpeakerId, setRimeSpeakerId,
        rimeModelId, setRimeModelId
    } = useMayler();

    const { triggerGoogleAuth } = useAuth();

    if (!showSettings) return null;

    const voices: Array<'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'> =
        ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

    return (
        <div className="settings-panel" onClick={() => setShowSettings(false)}>
            <div className="settings-content" onClick={(e) => e.stopPropagation()}>
                <div className="settings-header">
                    <h2>Settings</h2>
                </div>

                <div className="settings-sections">
                    <div className="setting-section">
                        <h3>Voice Engine</h3>
                        <div className="voice-grid">
                            <button
                                className={`voice-btn ${voiceEngine === 'openai' ? 'active' : ''}`}
                                onClick={() => setVoiceEngine('openai')}
                            >
                                OpenAI (Fast)
                            </button>

                            <button
                                className={`voice-btn ${voiceEngine === 'rime' ? 'active' : ''}`}
                                onClick={() => setVoiceEngine('rime')}
                            >
                                Rime (Instant)
                            </button>
                        </div>
                    </div>

                    <div className="setting-section">
                        <h3>
                            {voiceEngine === 'openai' ? 'OpenAI Voice' :
                                voiceEngine === 'rime' ? 'Rime Speaker' : 'Unknown'}

                        </h3>
                        {voiceEngine === 'openai' ? (
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
                        ) : (
                            <div className="voice-grid">
                                {['marsh', 'lagoon', 'moon', 'sky', 'amber'].map((speaker) => (
                                    <button
                                        key={speaker}
                                        className={`voice-btn ${rimeSpeakerId === speaker ? 'active' : ''}`}
                                        onClick={() => setRimeSpeakerId(speaker)}
                                    >
                                        {speaker.charAt(0).toUpperCase() + speaker.slice(1)}
                                    </button>
                                ))}
                            </div>
                        )}
                        {voiceEngine === 'rime' && (
                            <div style={{ marginTop: '15px' }}>
                                <h4>Model</h4>
                                <div className="voice-grid">
                                    <button
                                        className={`voice-btn ${rimeModelId === 'mist-v2' ? 'active' : ''}`}
                                        onClick={() => setRimeModelId('mist-v2')}
                                    >
                                        Mist v2 (Fast)
                                    </button>
                                    <button
                                        className={`voice-btn ${rimeModelId === 'arcana' ? 'active' : ''}`}
                                        onClick={() => setRimeModelId('arcana')}
                                    >
                                        Arcana (Quality)
                                    </button>
                                </div>
                            </div>
                        )}
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
