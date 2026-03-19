export type JSONObject = Record<string, unknown>;

export interface ChatMessage {
    id: string;
    type: 'user' | 'agent' | 'system';
    text: string;
    timestamp: number;
}

export type GoogleStatus = 'unknown' | 'available' | 'unavailable';

export type VoiceOption = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'fable' | 'onyx' | 'nova' | 'sage' | 'shimmer' | 'verse' | 'marin' | 'cedar';

export type VoiceEngine = 'openai';

export type VoicePipeline = 'openai-webrtc' | 'livekit-cloud';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface WebRTCSessionConfig {
    voice: VoiceOption;
    instructions: string;
}

export interface LiveKitSessionConfig {
    wsUrl: string;
    token: string;
    roomName: string;
    identity: string;
}
