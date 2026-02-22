const axios = require('axios');

const generateTTS = async (text, languageCode = 'hi-IN', speaker = 'priya') => {
    let apiKey = process.env.SARVAM_API_KEY;

    if (!apiKey) {
        throw new Error('SARVAM_API_KEY not found in environment');
    }

    // Robust cleaning for environment variables (Render/Netlify sometimes add quotes or spaces)
    apiKey = apiKey.trim().replace(/^["']|["']$/g, '');

    try {
        const formattedSpeaker = speaker.toLowerCase();
        console.log(`🎙️ [Backend] Calling Sarvam AI: Model=bulbul:v3, Speaker=${formattedSpeaker}, Key=${apiKey.substring(0, 5)}...`);

        const response = await axios.post('https://api.sarvam.ai/text-to-speech', {
            inputs: [text],
            target_language_code: languageCode,
            speaker: formattedSpeaker,
            model: 'bulbul:v3',
            pace: 1.0,
            speech_sample_rate: 16000
        }, {
            headers: {
                'api-subscription-key': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 25000 // Increased for high-quality v3 generation
        });

        if (response.data && response.data.audios && response.data.audios[0]) {
            return response.data.audios[0]; // This is typically a base64 encoded audio string
        } else {
            throw new Error('Invalid response from Sarvam AI');
        }
    } catch (error) {
        console.error('Sarvam AI TTS Error:', error.response ? error.response.data : error.message);
        throw error;
    }
};

module.exports = { generateTTS };
