import express from 'express';
import fetch from 'node-fetch';

// Rime speaker definitions with metadata
const RIME_SPEAKERS = {
    // Mist v2 Speakers - Fast, low latency
    'mist': {
        'marsh': { name: 'Marsh', gender: 'male', style: 'calm' },
        'lagoon': { name: 'Lagoon', gender: 'female', style: 'warm' },
        'cove': { name: 'Cove', gender: 'male', style: 'conversational' },
        'bay': { name: 'Bay', gender: 'female', style: 'professional' },
        'creek': { name: 'Creek', gender: 'male', style: 'friendly' },
        'brook': { name: 'Brook', gender: 'female', style: 'gentle' },
        'grove': { name: 'Grove', gender: 'male', style: 'deep' },
        'mesa': { name: 'Mesa', gender: 'female', style: 'energetic' },
        'vale': { name: 'Vale', gender: 'male', style: 'neutral' },
        'moon': { name: 'Moon', gender: 'female', style: 'soothing' },
    },
    // Arcana Speakers - Higher quality
    'arcana': {
        'cove': { name: 'Cove', gender: 'male', style: 'conversational' },
        'luna': { name: 'Luna', gender: 'female', style: 'expressive' },
        'ember': { name: 'Ember', gender: 'female', style: 'warm' },
        'orion': { name: 'Orion', gender: 'male', style: 'authoritative' },
        'nova': { name: 'Nova', gender: 'female', style: 'dynamic' },
        'atlas': { name: 'Atlas', gender: 'male', style: 'steady' },
        'iris': { name: 'Iris', gender: 'female', style: 'friendly' },
        'zephyr': { name: 'Zephyr', gender: 'male', style: 'calm' },
    }
};

export const createUtilityRouter = (utilityService) => {
    const router = express.Router();

    // Get available Rime speakers
    router.get('/tts/rime/speakers', (req, res) => {
        res.json(RIME_SPEAKERS);
    });

    // Rime TTS endpoint with streaming support
    router.post('/tts/rime', async (req, res) => {
        const { text, speakerId, modelId: requestedModel, speed, reduceLatency } = req.body;
        const apiKey = process.env.RIME_API_KEY;

        if (!apiKey) {
            return res.status(400).json({ error: 'RIME_API_KEY not configured' });
        }

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Text is required' });
        }

        try {
            const modelId = requestedModel || 'mist';
            const speaker = speakerId || 'cove';
            
            console.log(`[Rime TTS] Model: ${modelId}, Speaker: ${speaker}, Text length: ${text.length}`);

            const requestBody = {
                text: text.trim(),
                speaker: speaker,
                modelId: modelId,
            };

            // Speed/rate control (0.5 to 2.0)
            if (speed && speed >= 0.5 && speed <= 2.0) {
                requestBody.speedAlpha = speed;
            }

            // Reduce latency option for streaming scenarios
            if (reduceLatency) {
                requestBody.reduceLatency = true;
            }

            // Model-specific parameters
            if (modelId === 'arcana') {
                requestBody.samplingRate = 22050;
                requestBody.audioFormat = 'mp3';
            } else {
                // mist model defaults
                requestBody.samplingRate = 22050;
                requestBody.audioFormat = 'mp3';
            }

            const headers = {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            const response = await fetch('https://users.rime.ai/v1/rime-tts', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Rime TTS] API Error Status:', response.status);
                console.error('[Rime TTS] API Error Body:', errorText);
                throw new Error(`Rime API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const { audioContent } = data;
            
            if (!audioContent) {
                throw new Error('No audio content returned from Rime');
            }

            const audioBuffer = Buffer.from(audioContent, 'base64');
            
            // Determine content type based on format
            const contentType = requestBody.audioFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav';
            
            res.set({
                'Content-Type': contentType,
                'Content-Length': audioBuffer.length,
                'Cache-Control': 'no-cache',
                'X-Rime-Model': modelId,
                'X-Rime-Speaker': speaker
            });
            
            res.send(audioBuffer);
            
            console.log(`[Rime TTS] Success: ${audioBuffer.length} bytes`);
        } catch (err) {
            console.error('[Rime TTS] Failed:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // Streaming TTS endpoint for ultra-low latency
    router.post('/tts/rime/stream', async (req, res) => {
        const { text, speakerId, modelId: requestedModel } = req.body;
        const apiKey = process.env.RIME_API_KEY;

        if (!apiKey) {
            return res.status(400).json({ error: 'RIME_API_KEY not configured' });
        }

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Text is required' });
        }

        try {
            const modelId = requestedModel || 'mist';
            const speaker = speakerId || 'cove';

            // Split text into sentences for streaming playback
            const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
            
            res.set({
                'Content-Type': 'audio/mpeg',
                'Transfer-Encoding': 'chunked',
                'Cache-Control': 'no-cache',
                'X-Rime-Model': modelId,
                'X-Rime-Speaker': speaker
            });

            for (const sentence of sentences) {
                if (sentence.trim().length === 0) continue;

                const requestBody = {
                    text: sentence.trim(),
                    speaker: speaker,
                    modelId: modelId,
                    samplingRate: 22050,
                    audioFormat: 'mp3',
                    reduceLatency: true
                };

                const response = await fetch('https://users.rime.ai/v1/rime-tts', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    console.error('[Rime Stream] Chunk failed:', response.status);
                    continue;
                }

                const data = await response.json();
                if (data.audioContent) {
                    const audioBuffer = Buffer.from(data.audioContent, 'base64');
                    res.write(audioBuffer);
                }
            }

            res.end();
        } catch (err) {
            console.error('[Rime Stream] Failed:', err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: err.message });
            } else {
                res.end();
            }
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
