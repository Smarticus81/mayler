import express from 'express';
import fetch from 'node-fetch';

const OPENAI_REALTIME_MODEL = 'gpt-4o-mini-realtime-preview-2024-12-17';

export const createTokenRouter = () => {
    const router = express.Router();

    async function createOpenAIRealtimeEphemeralToken(options = {}) {
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            const err = new Error('OPENAI_API_KEY not configured');
            err.code = 'OPENAI_API_KEY_MISSING';
            throw err;
        }

        const voice = options.voice || process.env.OPENAI_VOICE || 'ash';
        const speed = Math.max(0.8, Math.min(1.15, Number(options.speed) || 0.9));

        const sessionConfig = {
            model: OPENAI_REALTIME_MODEL,
            modalities: ['text', 'audio'],
            voice,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: { model: 'gpt-4o-transcribe' },
            turn_detection: {
                type: 'server_vad',
                threshold: 0.35,
                prefix_padding_ms: 200,
                silence_duration_ms: 400,
                create_response: true,
            },
            temperature: 0.6,
            speed,
        };

        console.log('[Server] Minting ephemeral token with config:', JSON.stringify(sessionConfig, null, 2));

        const resp = await fetch('https://api.openai.com/v1/realtime/sessions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(sessionConfig),
        });

        const data = await resp.json().catch(() => null);

        if (!resp.ok) {
            const err = new Error('OpenAI error when creating realtime client secret');
            err.details = data || { status: resp.status, statusText: resp.statusText };
            throw err;
        }

        return { ...data, model: OPENAI_REALTIME_MODEL };
    }

    router.options('/', (_req, res) => res.status(204).end());

    router.get('/', async (_req, res) => {
        try {
            const result = await createOpenAIRealtimeEphemeralToken();
            res.setHeader('Cache-Control', 'no-store');
            res.json(result);
        } catch (err) {
            console.error('Failed to create OpenAI realtime token:', err);
            res.status(500).json({ error: err.message, details: err.details || null, code: err.code || null });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const { voice, speed } = req.body ?? {};
            const result = await createOpenAIRealtimeEphemeralToken({ voice, speed });
            res.setHeader('Cache-Control', 'no-store');
            res.json(result);
        } catch (err) {
            console.error('Failed to create OpenAI realtime token:', err);
            res.status(500).json({ error: err.message, details: err.details || null, code: err.code || null });
        }
    });

    return router;
};
