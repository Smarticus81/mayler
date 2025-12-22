import express from 'express';
import fetch from 'node-fetch';

export const createUtilityRouter = (utilityService) => {
    const router = express.Router();

    router.post('/tts/rime', async (req, res) => {
        const { text, speakerId } = req.body;
        const apiKey = process.env.RIME_API_KEY;

        if (!apiKey) {
            return res.status(400).json({ error: 'RIME_API_KEY not configured' });
        }

        try {
            const response = await fetch('https://api.rime.ai/v1/tts', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text,
                    speaker: speakerId || 'marsh',
                    modelId: 'mist-v2'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Rime API Error Status:', response.status);
                console.error('Rime API Error Body:', errorText);
                throw new Error(`Rime API error: ${response.status} - ${errorText}`);
            }

            const { audioContent } = await response.json();
            if (!audioContent) throw new Error('No audio content returned from Rime');

            const audioBuffer = Buffer.from(audioContent, 'base64');
            res.set({
                'Content-Type': 'audio/wav',
                'Content-Length': audioBuffer.length
            });
            res.send(audioBuffer);
        } catch (err) {
            console.error('Rime TTS failed:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/weather', async (req, res) => {
        try {
            const { location, units = 'fahrenheit' } = req.body;
            if (!location) return res.status(400).json({ error: 'Location required' });
            const result = await utilityService.getWeather(location, units);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/calculate', async (req, res) => {
        try {
            const { expression } = req.body;
            if (!expression) return res.status(400).json({ error: 'Expression required' });
            const result = utilityService.calculate(expression);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/convert', async (req, res) => {
        try {
            const { value, from, to } = req.body;
            if (value === undefined || !from || !to) return res.status(400).json({ error: 'Value, from, to required' });
            const result = utilityService.convertUnits(value, from, to);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/translate', async (req, res) => {
        try {
            const { text, targetLanguage, sourceLanguage } = req.body;
            if (!text || !targetLanguage) return res.status(400).json({ error: 'Text and target language required' });
            const result = await utilityService.translateText(text, targetLanguage, sourceLanguage);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/definition', async (req, res) => {
        try {
            const { word } = req.body;
            if (!word) return res.status(400).json({ error: 'Word required' });
            const result = await utilityService.getDefinition(word);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/wikipedia', async (req, res) => {
        try {
            const { query, sentences = 3 } = req.body;
            if (!query) return res.status(400).json({ error: 'Query required' });
            const result = await utilityService.wikipediaSearch(query, sentences);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/stock', async (req, res) => {
        try {
            const { symbol } = req.body;
            if (!symbol) return res.status(400).json({ error: 'Stock symbol required' });
            const result = await utilityService.getStockPrice(symbol);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/crypto', async (req, res) => {
        try {
            const { symbol, currency = 'USD' } = req.body;
            if (!symbol) return res.status(400).json({ error: 'Crypto symbol required' });
            const result = await utilityService.getCryptoPrice(symbol, currency);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/time', async (req, res) => {
        try {
            const { timezone } = req.body;
            const result = utilityService.getTime(timezone);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/currency', async (req, res) => {
        try {
            const { amount, from, to } = req.body;
            if (amount === undefined || !from || !to) return res.status(400).json({ error: 'Amount, from, and to required' });
            const result = await utilityService.convertCurrency(amount, from, to);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/timer', async (req, res) => {
        try {
            const { duration, label } = req.body;
            if (!duration) return res.status(400).json({ error: 'Duration required' });
            const result = utilityService.setTimer(duration, label);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/notes', async (req, res) => {
        try {
            const { title, content } = req.body;
            if (!content) return res.status(400).json({ error: 'Content required' });
            const result = utilityService.createNote(title, content);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
