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

export type ThemeMode = 'light' | 'dark' | 'system';

export interface WebRTCSessionConfig {
    voice: VoiceOption;
    instructions: string;
}
