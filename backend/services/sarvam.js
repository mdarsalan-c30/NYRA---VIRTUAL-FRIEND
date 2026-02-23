const axios = require('axios');

/**
 * Cleans text for natural speech (prevents robotic spelling of URLs)
 */
const cleanTextForTTS = (text) => {
    if (!text) return text;
    return text
        .replace(/<URL>[\s\S]*?<\/URL>/gi, "Link") // Replace <URL>content</URL> with just "Link"
        .replace(/https?:\/\/\S+/gi, "") // Remove any remaining naked URLs
        .replace(/[\[\]\(\)]/g, " ")     // Remove brackets/parentheses
        .replace(/\.com/gi, " dot com")
        .replace(/\.in/gi, " dot in")
        .replace(/\.org/gi, " dot org")
        .replace(/\.net/gi, " dot net")
        .replace(/\.app/gi, " dot app")
        .replace(/\.vercel/gi, " dot vercel")
        .replace(/\.ai/gi, " dot ai")
        .replace(/\//g, " ") // Replace slashes with spaces for pause
        .replace(/-/g, " ")  // Replace dashes with spaces
        .replace(/_/g, " "); // Replace underscores with spaces
};

const generateTTS = async (text, languageCode = 'hi-IN', speaker = 'priya') => {
    const cleanedText = cleanTextForTTS(text);
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
            inputs: [cleanedText],
            target_language_code: languageCode,
            speaker: formattedSpeaker,
            model: 'bulbul:v2', // Switched to v2 for high-speed low-latency generation
            pace: 1.1,          // Slightly faster pace for a snappier feel
            speech_sample_rate: 16000
        }, {
            headers: {
                'api-subscription-key': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000 // Reduced timeout: v2 should respond within seconds
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
