import React from 'react';
import { useMayler } from '../context/MaylerContext';
import { useAuth } from '../hooks/useAuth';

// Rime speaker definitions
const RIME_MIST_SPEAKERS = [
    { id: 'cove', name: 'Cove', gender: 'M', style: 'Conversational' },
    { id: 'marsh', name: 'Marsh', gender: 'M', style: 'Calm' },
    { id: 'lagoon', name: 'Lagoon', gender: 'F', style: 'Warm' },
    { id: 'bay', name: 'Bay', gender: 'F', style: 'Professional' },
    { id: 'creek', name: 'Creek', gender: 'M', style: 'Friendly' },
    { id: 'brook', name: 'Brook', gender: 'F', style: 'Gentle' },
    { id: 'grove', name: 'Grove', gender: 'M', style: 'Deep' },
    { id: 'mesa', name: 'Mesa', gender: 'F', style: 'Energetic' },
    { id: 'vale', name: 'Vale', gender: 'M', style: 'Neutral' },
    { id: 'moon', name: 'Moon', gender: 'F', style: 'Soothing' },
];

const RIME_ARCANA_SPEAKERS = [
    { id: 'cove', name: 'Cove', gender: 'M', style: 'Conversational' },
    { id: 'luna', name: 'Luna', gender: 'F', style: 'Expressive' },
    { id: 'ember', name: 'Ember', gender: 'F', style: 'Warm' },
    { id: 'orion', name: 'Orion', gender: 'M', style: 'Authoritative' },
    { id: 'nova', name: 'Nova', gender: 'F', style: 'Dynamic' },
    { id: 'atlas', name: 'Atlas', gender: 'M', style: 'Steady' },
    { id: 'iris', name: 'Iris', gender: 'F', style: 'Friendly' },
    { id: 'zephyr', name: 'Zephyr', gender: 'M', style: 'Calm' },
];

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

    const rimeSpeakers = rimeModelId === 'arcana' ? RIME_ARCANA_SPEAKERS : RIME_MIST_SPEAKERS;

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
                                OpenAI Realtime
                            </button>

                            <button
                                className={`voice-btn ${voiceEngine === 'rime' ? 'active' : ''}`}
                                onClick={() => setVoiceEngine('rime')}
                            >
                                Rime TTS
                            </button>
                        </div>
                    </div>

                    {voiceEngine === 'rime' && (
                        <div className="setting-section">
                            <h3>Rime Model</h3>
                            <div className="voice-grid">
                                <button
                                    className={`voice-btn ${rimeModelId === 'mist' ? 'active' : ''}`}
                                    onClick={() => {
                                        setRimeModelId('mist');
                                        // Reset speaker if not available in new model
                                        if (!RIME_MIST_SPEAKERS.find(s => s.id === rimeSpeakerId)) {
                                            setRimeSpeakerId('cove');
                                        }
                                    }}
                                >
                                    Mist (Fast)
                                </button>
                                <button
                                    className={`voice-btn ${rimeModelId === 'arcana' ? 'active' : ''}`}
                                    onClick={() => {
                                        setRimeModelId('arcana');
                                        // Reset speaker if not available in new model
                                        if (!RIME_ARCANA_SPEAKERS.find(s => s.id === rimeSpeakerId)) {
                                            setRimeSpeakerId('cove');
                                        }
                                    }}
                                >
                                    Arcana (Quality)
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="setting-section">
                        <h3>
                            {voiceEngine === 'openai' ? 'OpenAI Voice' : 'Rime Speaker'}
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
                            <div className="voice-grid rime-speakers">
                                {rimeSpeakers.map((speaker) => (
                                    <button
                                        key={speaker.id}
                                        className={`voice-btn ${rimeSpeakerId === speaker.id ? 'active' : ''}`}
                                        onClick={() => setRimeSpeakerId(speaker.id)}
                                        title={`${speaker.style} - ${speaker.gender === 'M' ? 'Male' : 'Female'}`}
                                    >
                                        <span className="speaker-name">{speaker.name}</span>
                                        <span className="speaker-meta">{speaker.gender} / {speaker.style}</span>
                                    </button>
                                ))}
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
