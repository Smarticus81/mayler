import express from 'express';
import OpenAI from 'openai';

export const createVisionRouter = () => {
    const router = express.Router();

    router.post('/analyze-documents', async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('📸 [Vision API] Analyzing documents with GPT-5.2');
        console.log(`📋 Images: ${req.body.images?.length || 0}`);
        console.log(`📝 Query: "${req.body.query}"`);
        console.log('═══════════════════════════════════════════════════════════════');

        try {
            const { images, query } = req.body;

            if (!images || images.length === 0) {
                throw new Error('No images provided');
            }

            const openaiApiKey = process.env.OPENAI_API_KEY;
            if (!openaiApiKey) {
                throw new Error('OPENAI_API_KEY not configured');
            }

            const openai = new OpenAI({ apiKey: openaiApiKey });

            // Build content array with text + images
            const content = [
                {
                    type: 'text',
                    text: query || 'Analyze these documents and provide detailed insights, extract key information, and summarize the content.'
                }
            ];

            // Add all images
            images.forEach((base64Image) => {
                content.push({
                    type: 'image_url',
                    image_url: {
                        url: `data:image/jpeg;base64,${base64Image}`
                    }
                });
            });

            console.log('🔄 [Vision API] Sending request to GPT-5.2...');

            // Use Responses API (recommended for GPT-5.2)
            const response = await openai.responses.create({
                model: 'gpt-5.2',
                input: content,
                reasoning: {
                    effort: 'none' // Fast analysis; increase to 'medium' for complex docs
                },
                text: {
                    verbosity: 'medium' // Balanced output
                },
                max_output_tokens: 2000
            });

            const analysis = response.text || response.output?.[0]?.text || 'Analysis complete';

            console.log(`✅ [Vision API] Analysis complete`);
            console.log(`📊 Tokens - Reasoning: ${response.usage?.reasoning_tokens || 0}, Total: ${response.usage?.total_tokens || 0}`);
            console.log('═══════════════════════════════════════════════════════════════\n');

            res.json({
                success: true,
                analysis,
                reasoning_tokens: response.usage?.reasoning_tokens || 0,
                total_tokens: response.usage?.total_tokens || 0
            });

        } catch (error) {
            console.error('❌ [Vision API] Analysis failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    return router;
};
