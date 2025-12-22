export type JSONObject = Record<string, unknown>;

export interface ChatMessage {
    id: string;
    type: 'user' | 'agent' | 'system';
    text: string;
}

export type GoogleStatus = 'unknown' | 'available' | 'unavailable';

export type VoiceOption = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse' | 'marin' | 'cedar';

export type VoiceEngine = 'openai';

export interface WebRTCSessionConfig {
    voice: VoiceOption;
    instructions: string;
}
