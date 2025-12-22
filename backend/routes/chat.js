import express from 'express';
import fetch from 'node-fetch';

export const createChatRouter = () => {
    const router = express.Router();

    router.post('/completion', async (req, res) => {
        try {
            const { messages, tools } = req.body;
            const apiKey = process.env.OPENAI_API_KEY;

            if (!apiKey) {
                return res.status(500).json({ error: 'OpenAI API key not configured' });
            }

            const requestBody = {
                model: 'gpt-4o',
                messages,
                temperature: 0.7,
            };

            // Only add tools if they exist
            if (tools && tools.length > 0) {
                requestBody.tools = tools;
                requestBody.tool_choice = 'auto';
            }

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('OpenAI API error:', data);
                throw new Error(data.error?.message || 'OpenAI API error');
            }

            const choice = data.choices[0];

            res.json({
                message: choice.message.content || '',
                tool_calls: choice.message.tool_calls || [],
                finish_reason: choice.finish_reason,
            });
        } catch (error) {
            console.error('Chat completion error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
