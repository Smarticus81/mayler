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
        elevenLabsVoiceId, setElevenLabsVoiceId,
        rimeSpeakerId, setRimeSpeakerId
    } = useMayler();

    const { triggerGoogleAuth } = useAuth();

    if (!showSettings) return null;

    const voices: Array<'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'> =
        ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

    return (
        <div className="settings-overlay">
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                <div className="settings-header">
                    <h2>Settings</h2>
                </div>

                <div className="settings-content">
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
                                className={`voice-btn ${voiceEngine === 'elevenlabs' ? 'active' : ''}`}
                                onClick={() => setVoiceEngine('elevenlabs')}
                            >
                                ElevenLabs (HD)
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
                                voiceEngine === 'elevenlabs' ? 'ElevenLabs Voice' : 'Rime Speaker'}
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
                        ) : voiceEngine === 'elevenlabs' ? (
                            <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                                <label style={{ fontSize: '12px', opacity: 0.7 }}>ElevenLabs Voice ID</label>
                                <input
                                    type="text"
                                    value={elevenLabsVoiceId}
                                    onChange={(e) => setElevenLabsVoiceId(e.target.value)}
                                    placeholder="Enter Voice ID"
                                    className="settings-input"
                                    style={{
                                        background: 'var(--glass-bg)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '8px',
                                        padding: '8px 12px',
                                        color: 'var(--text-primary)',
                                        fontSize: '14px'
                                    }}
                                />
                                <span style={{ fontSize: '11px', opacity: 0.5 }}>Try ID: JBFqnCBsd6RMkjVDRZzb (George) or N2lVS1wzexvYrd31Y2qn (Domi)</span>
                            </div>
                        ) : (
                            <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                                <label style={{ fontSize: '12px', opacity: 0.7 }}>Rime Speaker ID</label>
                                <input
                                    type="text"
                                    value={rimeSpeakerId}
                                    onChange={(e) => setRimeSpeakerId(e.target.value)}
                                    placeholder="Enter Speaker ID"
                                    className="settings-input"
                                    style={{
                                        background: 'var(--glass-bg)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '8px',
                                        padding: '8px 12px',
                                        color: 'var(--text-primary)',
                                        fontSize: '14px'
                                    }}
                                />
                                <span style={{ fontSize: '11px', opacity: 0.5 }}>Try IDs: marsh, amber, george, kevin, kyna</span>
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
