import React, { useCallback, useRef } from 'react';
import { useMayler } from '../context/MaylerContext';
import { useAuth } from '../hooks/useAuth';
import type { VoiceOption, VoicePipeline, ThemeMode } from '../types';

export const SettingsModal: React.FC = () => {
    const {
        showSettings, setShowSettings,
        wakeWordEnabled, setWakeWordEnabled,
        googleStatus,
        selectedVoice, setSelectedVoice,
        voicePipeline, setVoicePipeline,
        livekitAvailable,
        themeMode, setThemeMode,
    } = useMayler();

    const { triggerGoogleAuth } = useAuth();
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    const voices: Array<{ id: VoiceOption; label: string }> = [
        { id: 'alloy', label: 'Alloy' },
        { id: 'ash', label: 'Ash' },
        { id: 'ballad', label: 'Ballad' },
        { id: 'coral', label: 'Coral' },
        { id: 'echo', label: 'Echo' },
        { id: 'fable', label: 'Fable' },
        { id: 'nova', label: 'Nova' },
        { id: 'onyx', label: 'Onyx' },
        { id: 'sage', label: 'Sage' },
        { id: 'shimmer', label: 'Shimmer' },
        { id: 'verse', label: 'Verse' },
        { id: 'marin', label: 'Marin' },
        { id: 'cedar', label: 'Cedar' },
    ];

    const themes: Array<{ id: ThemeMode; label: string }> = [
        { id: 'light', label: 'Light' },
        { id: 'dark', label: 'Dark' },
        { id: 'system', label: 'Auto' },
    ];

    const handleVoiceSelect = useCallback(async (voice: VoiceOption) => {
        setSelectedVoice(voice);

        // Preview voice with a short phrase
        try {
            if (previewAudioRef.current) {
                previewAudioRef.current.pause();
                previewAudioRef.current = null;
            }

            const resp = await fetch('/api/rime/generate-greeting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: 'Hello, I\'m ready.', voice }),
            });

            if (resp.ok) {
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audio.volume = 0.6;
                audio.onended = () => URL.revokeObjectURL(url);
                previewAudioRef.current = audio;
                audio.play().catch(() => {});
            }
        } catch {
            // Silent fail for preview
        }
    }, [setSelectedVoice]);

    return (
        <div className={`settings-panel ${showSettings ? 'open' : ''}`}>
            <div className="settings-backdrop" onClick={() => setShowSettings(false)} />
            <div className="settings-content">
                <div className="settings-header">
                    <h2>Settings</h2>
                    <button className="settings-close-btn" onClick={() => setShowSettings(false)}>
                        &#x2715;
                    </button>
                </div>

                <div className="settings-sections">
                    {/* Theme */}
                    <div className="setting-section">
                        <h3>Appearance</h3>
                        <div className="setting-item">
                            <div className="setting-info">
                                <label>Theme</label>
                                <span className="setting-description">Choose your preferred color scheme</span>
                            </div>
                            <div className="theme-selector">
                                {themes.map((theme) => (
                                    <button
                                        key={theme.id}
                                        className={`theme-option ${themeMode === theme.id ? 'active' : ''}`}
                                        onClick={() => setThemeMode(theme.id)}
                                    >
                                        {theme.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Voice Pipeline */}
                    <div className="setting-section">
                        <h3>Voice Pipeline</h3>
                        <div className="setting-item">
                            <div className="setting-info">
                                <label>Engine</label>
                                <span className="setting-description">
                                    {voicePipeline === 'livekit-cloud'
                                        ? 'LiveKit Cloud — adaptive interruption, multi-modal, low latency'
                                        : 'OpenAI WebRTC — direct realtime connection'}
                                </span>
                            </div>
                            <div className="theme-selector">
                                <button
                                    className={`theme-option ${voicePipeline === 'openai-webrtc' ? 'active' : ''}`}
                                    onClick={() => setVoicePipeline('openai-webrtc')}
                                >
                                    OpenAI
                                </button>
                                <button
                                    className={`theme-option ${voicePipeline === 'livekit-cloud' ? 'active' : ''}`}
                                    onClick={() => setVoicePipeline('livekit-cloud')}
                                    disabled={!livekitAvailable}
                                    title={!livekitAvailable ? 'LiveKit not configured on server' : ''}
                                >
                                    LiveKit{!livekitAvailable ? ' (N/A)' : ''}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Voice */}
                    <div className="setting-section">
                        <h3>Voice</h3>
                        <div className="voice-grid">
                            {voices.map((voice) => (
                                <button
                                    key={voice.id}
                                    className={`voice-btn ${selectedVoice === voice.id ? 'active' : ''}`}
                                    onClick={() => handleVoiceSelect(voice.id)}
                                >
                                    {voice.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Recognition */}
                    <div className="setting-section">
                        <h3>Recognition</h3>
                        <div className="setting-item">
                            <div className="setting-info">
                                <label>Wake Word</label>
                                <span className="setting-description">Say "Hey Mayler" to activate</span>
                            </div>
                            <div
                                className={`toggle-switch ${wakeWordEnabled ? 'active' : ''}`}
                                onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
                                role="switch"
                                aria-checked={wakeWordEnabled}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setWakeWordEnabled(!wakeWordEnabled);
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* Integrations */}
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
            </div>
        </div>
    );
};
