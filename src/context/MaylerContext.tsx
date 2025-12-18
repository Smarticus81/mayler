import React, { createContext, useContext, useState } from 'react';
import type { ReactNode, Dispatch, SetStateAction } from 'react';
import type { GoogleStatus, VoiceOption, VoiceEngine } from '../types';

interface MaylerContextType {
    // Connection State
    connected: boolean;
    setConnected: Dispatch<SetStateAction<boolean>>;
    loading: boolean;
    setLoading: Dispatch<SetStateAction<boolean>>;
    error: string;
    setError: Dispatch<SetStateAction<string>>;

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

    // User Preferences / Settings
    wakeWordEnabled: boolean;
    setWakeWordEnabled: Dispatch<SetStateAction<boolean>>;
    googleStatus: GoogleStatus;
    setGoogleStatus: Dispatch<SetStateAction<GoogleStatus>>;
    selectedVoice: VoiceOption;
    setSelectedVoice: Dispatch<SetStateAction<VoiceOption>>;
    voiceEngine: VoiceEngine;
    setVoiceEngine: Dispatch<SetStateAction<VoiceEngine>>;
    elevenLabsVoiceId: string;
    setElevenLabsVoiceId: Dispatch<SetStateAction<string>>;
    rimeSpeakerId: string;
    setRimeSpeakerId: Dispatch<SetStateAction<string>>;
    showSettings: boolean;
    setShowSettings: Dispatch<SetStateAction<boolean>>;
}

const MaylerContext = createContext<MaylerContextType | undefined>(undefined);

export const MaylerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [speaking, setSpeaking] = useState(false);
    const [listening, setListening] = useState(false);
    const [isWakeMode, setIsWakeMode] = useState(true);

    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [agentTranscript, setAgentTranscript] = useState('');
    const [agentInterimTranscript, setAgentInterimTranscript] = useState('');

    const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
    const [googleStatus, setGoogleStatus] = useState<GoogleStatus>('unknown');
    const [selectedVoice, setSelectedVoice] = useState<VoiceOption>('alloy');
    const [voiceEngine, setVoiceEngine] = useState<VoiceEngine>('openai');
    const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState<string>('JBFqnCBsd6RMkjVDRZzb'); // George
    const [rimeSpeakerId, setRimeSpeakerId] = useState<string>('marsh');
    const [showSettings, setShowSettings] = useState(false);

    const value = {
        connected, setConnected,
        loading, setLoading,
        error, setError,
        speaking, setSpeaking,
        listening, setListening,
        isWakeMode, setIsWakeMode,
        transcript, setTranscript,
        interimTranscript, setInterimTranscript,
        agentTranscript, setAgentTranscript,
        agentInterimTranscript, setAgentInterimTranscript,
        wakeWordEnabled, setWakeWordEnabled,
        googleStatus, setGoogleStatus,
        selectedVoice, setSelectedVoice,
        voiceEngine, setVoiceEngine,
        elevenLabsVoiceId, setElevenLabsVoiceId,
        rimeSpeakerId, setRimeSpeakerId,
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
