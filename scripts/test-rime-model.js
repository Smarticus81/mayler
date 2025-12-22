import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.RIME_API_KEY;

async function testModel(modelId) {
    console.log(`Testing model: ${modelId}...`);
    try {
        const response = await fetch('https://users.rime.ai/v1/rime-tts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: 'Test',
                speaker: 'lagoon', // Try lagoon
                modelId: 'arcana'
            })
        });

        if (response.ok) {
            console.log(`✅ Model '${modelId}' is VALID.`);
        } else {
            console.log(`❌ Model '${modelId}' FAILED. Status: ${response.status}`);
            console.log(await response.text());
        }
    } catch (e) {
        console.error(e);
    }
}

testModel('arcana-v1');
