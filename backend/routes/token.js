import express from 'express';
import fetch from 'node-fetch';

export const createTokenRouter = () => {
    const router = express.Router();

    async function createOpenAIRealtimeEphemeralToken() {
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            const err = new Error('OPENAI_API_KEY not configured');
            err.code = 'OPENAI_API_KEY_MISSING';
            throw err;
        }

        const model = 'gpt-4o-realtime-preview';
        const voice = process.env.OPENAI_VOICE || 'verse';

        const sessionConfig = {
            model,
            voice,
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

        return { ...data, model };
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

    router.post('/', async (_req, res) => {
        try {
            const result = await createOpenAIRealtimeEphemeralToken();
            res.setHeader('Cache-Control', 'no-store');
            res.json(result);
        } catch (err) {
            console.error('Failed to create OpenAI realtime token:', err);
            res.status(500).json({ error: err.message, details: err.details || null, code: err.code || null });
        }
    });

    return router;
};
