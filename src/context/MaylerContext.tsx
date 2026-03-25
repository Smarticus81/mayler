import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode, Dispatch, SetStateAction } from 'react';
import type { GoogleStatus, VoiceOption, VoiceEngine, VoicePipeline, ThemeMode, ChatMessage, AppMode, AgentState } from '../types';

interface MaylerContextType {
    // Connection State
    connected: boolean;
    setConnected: Dispatch<SetStateAction<boolean>>;
    loading: boolean;
    setLoading: Dispatch<SetStateAction<boolean>>;
    error: string;
    setError: Dispatch<SetStateAction<string>>;

    // App State Machine (per OpenAI Voice Pipeline spec)
    appMode: AppMode;
    setAppMode: Dispatch<SetStateAction<AppMode>>;
    agentState: AgentState;
    setAgentState: Dispatch<SetStateAction<AgentState>>;

    // Interaction State
    speaking: boolean;
    setSpeaking: Dispatch<SetStateAction<boolean>>;
    listening: boolean;
    setListening: Dispatch<SetStateAction<boolean>>;
    isWakeMode: boolean;
    setIsWakeMode: Dispatch<SetStateAction<boolean>>;

    // Transcripts
    transcript: string;
    setTranscript: Dispatch<SetStateAction<string>>;
    interimTranscript: string;
    setInterimTranscript: Dispatch<SetStateAction<string>>;
    agentTranscript: string;
    setAgentTranscript: Dispatch<SetStateAction<string>>;
    agentInterimTranscript: string;
    setAgentInterimTranscript: Dispatch<SetStateAction<string>>;

    // Chat History
    chatHistory: ChatMessage[];
    addChatMessage: (type: ChatMessage['type'], text: string) => void;
    clearChatHistory: () => void;

    // User Preferences / Settings
    wakeWordEnabled: boolean;
    setWakeWordEnabled: Dispatch<SetStateAction<boolean>>;
    googleStatus: GoogleStatus;
    setGoogleStatus: Dispatch<SetStateAction<GoogleStatus>>;
    selectedVoice: VoiceOption;
    setSelectedVoice: Dispatch<SetStateAction<VoiceOption>>;
    voiceSpeed: number;
    setVoiceSpeed: Dispatch<SetStateAction<number>>;
    voiceEngine: VoiceEngine;
    setVoiceEngine: Dispatch<SetStateAction<VoiceEngine>>;
    voicePipeline: VoicePipeline;
    setVoicePipeline: Dispatch<SetStateAction<VoicePipeline>>;
    livekitAvailable: boolean;
    setLivekitAvailable: Dispatch<SetStateAction<boolean>>;

    // Theme
    themeMode: ThemeMode;
    setThemeMode: Dispatch<SetStateAction<ThemeMode>>;
    resolvedTheme: 'light' | 'dark';

    showSettings: boolean;
    setShowSettings: Dispatch<SetStateAction<boolean>>;
}

const MaylerContext = createContext<MaylerContextType | undefined>(undefined);

export const MaylerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // App State Machine (per OpenAI Voice Pipeline spec)
    const [appMode, setAppMode] = useState<AppMode>('idle');
    const [agentState, setAgentState] = useState<AgentState>('disconnected');

    const [speaking, setSpeaking] = useState(false);
    const [listening, setListening] = useState(false);
    const [isWakeMode, setIsWakeMode] = useState(true);

    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [agentTranscript, setAgentTranscript] = useState('');
    const [agentInterimTranscript, setAgentInterimTranscript] = useState('');

    // Chat history for transcript display
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

    const addChatMessage = useCallback((type: ChatMessage['type'], text: string) => {
        if (!text.trim()) return;
        setChatHistory(prev => {
            const newMsg: ChatMessage = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type,
                text: text.trim(),
                timestamp: Date.now(),
            };
            const updated = [...prev, newMsg];
            return updated.length > 50 ? updated.slice(-50) : updated;
        });
    }, []);

    const clearChatHistory = useCallback(() => {
        setChatHistory([]);
    }, []);

    const [wakeWordEnabled, setWakeWordEnabled] = useState(() => {
        const stored = localStorage.getItem('mayler_wake_word');
        return stored !== 'false';
    });
    const [googleStatus, setGoogleStatus] = useState<GoogleStatus>('unknown');
    const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(() => {
        const supportedVoices: VoiceOption[] = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
        const stored = localStorage.getItem('mayler_voice');
        if (stored && supportedVoices.includes(stored as VoiceOption)) {
            return stored as VoiceOption;
        }
        return 'ash';
    });
    const [voiceSpeed, setVoiceSpeed] = useState<number>(() => {
        const stored = localStorage.getItem('mayler_speed');
        return stored ? parseFloat(stored) : 0.9;
    });
    const [voiceEngine, setVoiceEngine] = useState<VoiceEngine>(() => {
        const stored = localStorage.getItem('mayler_engine');
        return (stored as VoiceEngine) || 'openai';
    });
    const [voicePipeline, setVoicePipeline] = useState<VoicePipeline>(() => {
        const stored = localStorage.getItem('mayler_pipeline');
        return (stored as VoicePipeline) || 'openai-webrtc';
    });
    const [livekitAvailable, setLivekitAvailable] = useState(false);

    // Theme
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
        const stored = localStorage.getItem('mayler_theme');
        return (stored as ThemeMode) || 'system';
    });

    const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
        window.matchMedia('(prefers-color-scheme: dark)').matches
    );

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const resolvedTheme: 'light' | 'dark' = themeMode === 'system'
        ? (systemPrefersDark ? 'dark' : 'light')
        : themeMode;

    // Apply theme to document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', resolvedTheme);
    }, [resolvedTheme]);

    const [showSettings, setShowSettings] = useState(false);

    // Persist settings to localStorage
    useEffect(() => {
        localStorage.setItem('mayler_wake_word', String(wakeWordEnabled));
    }, [wakeWordEnabled]);

    useEffect(() => {
        localStorage.setItem('mayler_voice', selectedVoice);
    }, [selectedVoice]);

    useEffect(() => {
        localStorage.setItem('mayler_speed', String(voiceSpeed));
    }, [voiceSpeed]);

    useEffect(() => {
        localStorage.setItem('mayler_engine', voiceEngine);
    }, [voiceEngine]);

    useEffect(() => {
        localStorage.setItem('mayler_pipeline', voicePipeline);
    }, [voicePipeline]);

    // Check if LiveKit is available on mount
    useEffect(() => {
        fetch('/api/livekit/status')
            .then(r => r.json())
            .then(data => setLivekitAvailable(data.configured === true))
            .catch(() => setLivekitAvailable(false));
    }, []);

    useEffect(() => {
        localStorage.setItem('mayler_theme', themeMode);
    }, [themeMode]);

    const value = {
        connected, setConnected,
        loading, setLoading,
        error, setError,
        appMode, setAppMode,
        agentState, setAgentState,
        speaking, setSpeaking,
        listening, setListening,
        isWakeMode, setIsWakeMode,
        transcript, setTranscript,
        interimTranscript, setInterimTranscript,
        agentTranscript, setAgentTranscript,
        agentInterimTranscript, setAgentInterimTranscript,
        chatHistory, addChatMessage, clearChatHistory,
        wakeWordEnabled, setWakeWordEnabled,
        googleStatus, setGoogleStatus,
        selectedVoice, setSelectedVoice,
        voiceSpeed, setVoiceSpeed,
        voiceEngine, setVoiceEngine,
        voicePipeline, setVoicePipeline,
        livekitAvailable, setLivekitAvailable,
        themeMode, setThemeMode,
        resolvedTheme,
        showSettings, setShowSettings,
    };

    return <MaylerContext.Provider value={value}>{children}</MaylerContext.Provider>;
};

export const useMayler = () => {
    const context = useContext(MaylerContext);
    if (context === undefined) {
        throw new Error('useMayler must be used within a MaylerProvider');
    }
    return context;
};
