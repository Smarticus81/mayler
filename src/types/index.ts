export type JSONObject = Record<string, unknown>;

export interface ChatMessage {
    id: string;
    type: 'user' | 'agent' | 'system';
    text: string;
}

export type GoogleStatus = 'unknown' | 'available' | 'unavailable';

export type VoiceOption = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export type VoiceEngine = 'openai' | 'rime';

export interface WebRTCSessionConfig {
    voice: VoiceOption;
    instructions: string;
}
