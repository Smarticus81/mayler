import express from 'express';
import OpenAI from 'openai';

export const createRimeRouter = () => {
    const router = express.Router();

    // Generate greeting audio with OpenAI TTS
    router.post('/generate-greeting', async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('🎤 [OpenAI TTS] Generating greeting audio');
        console.log('═══════════════════════════════════════════════════════════════');

        try {
            const { text = "Hey! What can I help you with?", voice = "alloy" } = req.body;

            const openaiApiKey = process.env.OPENAI_API_KEY;
            if (!openaiApiKey) {
                throw new Error('OPENAI_API_KEY not configured');
            }

            const openai = new OpenAI({ apiKey: openaiApiKey });

            console.log(`📝 Text: "${text}"`);
            console.log(`🎙️ Voice: ${voice}`);

            const mp3 = await openai.audio.speech.create({
                model: "tts-1-hd",
                voice: voice,
                input: text,
                speed: 1.05,
                response_format: "mp3",
            });

            const buffer = Buffer.from(await mp3.arrayBuffer());

            console.log(`✅ [OpenAI TTS] Generated ${buffer.length} bytes of audio`);
            console.log('═══════════════════════════════════════════════════════════════\n');

            res.set('Content-Type', 'audio/mpeg');
            res.send(buffer);
        } catch (error) {
            console.error('❌ [OpenAI TTS] Generation failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
