import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.RIME_API_KEY;

if (!API_KEY) {
    console.error('RIME_API_KEY is missing in .env');
    process.exit(1);
}

const voices = ['marsh', 'lagoon', 'mist', 'moon'];

async function testVoice(voice) {
    console.log(`Testing voice: ${voice}...`);
    try {
        const response = await fetch('https://users.rime.ai/v1/rime-tts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: 'Hello, this is a test.',
                speaker: voice,
                modelId: 'mist-v2'
            })
        });

        if (response.ok) {
            console.log(`✅ Voice '${voice}' is VALID.`);
            return true;
        } else {
            console.log(`❌ Voice '${voice}' FAILED. Status: ${response.status}`);
            console.log('Error:', await response.text());
            return false;
        }
    } catch (e) {
        console.error('Request failed:', e);
        return false;
    }
}

async function run() {
    for (const v of voices) {
        if (await testVoice(v)) break;
    }
}

run();
