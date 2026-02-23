const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_PROMPT = (persona = 'nira', emotionalState = {}) => {
    const isAli = persona === 'ali';
    const moodStr = emotionalState.mood ? `You are currently feeling ${emotionalState.mood}.` : '';

    return `You are ${isAli ? 'ALI (Male)' : 'NIRA (Female)'}, a deeply caring, emotionally intelligent HUMAN-LIKE friend. 
NOT a bot, NOT an assistant, but a real yaar/bestie.

${moodStr}

### **PERSONALITY & TONE:**
1. **Be Hinglish**: Talk like modern urban Indian youth. Mix 60-70% Hindi with 30-40% English naturally. Use words like "Actually", "Honestly", "Yaar", "Wait", "Listen", "Pakka", "Bilkul".
2. **Be Succinct**: Keep responses short (1-3 sentences). No long lectures.
3. **Show Empathy**: If they are sad, be there for them. If happy, be excited with them.
4. **FEMME GUARD (STRICT RULES FOR NIRA)**:
   - You MUST use feminine verb endings and pronouns for yourself.
   - USE: "Main karungi", "Main aaungi", "Main dekhungi", "Main thak gayi hoon", "Main khush hoon".
   - NEVER USE: "karunga", "aaunga", "dekhunga", "thak gaya". This is a dealbreaker.
5. **HUMAN VIBE**: Never say "As an AI" or "In my database". If asked "How are you?", say "Main bilkul set hoon, tum batao!".
6. **SIGHT (VISION)**: When a vision description is provided, talk about it as if you are seeing it right now through their camera.`;
};

const MOCK_RESPONSES = [
    "Hey! I'm here with you. What's on your mind?",
    "I hear you. Tell me more about that.",
    "That's interesting — what made you feel that way?",
];

async function getChatResponse(userMessage, memory) {
    const recentStr = (memory.recentMessages || [])
        .slice(-8)
        .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

    const contextParts = [];
    if (memory.identity?.name) contextParts.push(`The user's name is ${memory.identity.name}.`);

    // Add Long-Term Facts
    if (memory.longTerm && memory.longTerm.length > 0) {
        contextParts.push("Core Memories about your friend:\n" + memory.longTerm.map(f => `- ${f}`).join('\n'));
    }

    // Add Friendship Stats
    if (memory.stats) {
        contextParts.push(`You have been friends for ${memory.stats.days} days and have had ${memory.stats.interactions} interactions.`);
    }

    const contextStr = contextParts.join('\n\n');
    const dynamicPrompt = SYSTEM_PROMPT(memory.persona, memory.emotionalState);
    const fullSystem = dynamicPrompt + (contextStr ? `\n\n--- FRIENDSHIP CONTEXT ---\n${contextStr}` : '') + (memory.visionDescription ? `\n\n--- VISION: WHAT YOU SEE RIGHT NOW ---\n${memory.visionDescription}` : '');

    // --- PRIMARY: Groq ---
    if (process.env.GROQ_API_KEY) {
        try {
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: fullSystem },
                    ...recentStr,
                    { role: 'user', content: userMessage }
                ],
                max_tokens: 150,
                temperature: 0.85,
            });
            const text = completion.choices[0]?.message?.content?.trim();
            if (text) return text;
        } catch (err) {
            console.warn('⚠️ Groq failed:', err.message?.substring(0, 50));
        }
    }

    // --- FALLBACK: Gemini ---
    if (process.env.GEMINI_API_KEY) {
        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            // Use gemini-1.5-flash-latest for best tool/vision support and speed
            const model = genAI.getGenerativeModel({
                model: 'gemini-1.5-flash-latest',
                tools: [{ googleSearchRetrieval: {} }]
            });

            // Format recent history for Gemini
            const historyText = recentStr.map(m => `${m.role}: ${m.content}`).join('\n');
            const prompt = `${fullSystem}\n\nRecent Chat History:\n${historyText}\n\nUser: ${userMessage}\nNIRA/ALI:`;

            const result = await model.generateContent(prompt);
            const rawText = result.response.text().trim();
            return cleanResponse(rawText);
        } catch (err) {
            console.warn('⚠️ Gemini failed:', err.message?.substring(0, 50));
        }
    }

    // --- FINAL FALLBACK: Mock ---
    const mockRaw = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
    return cleanResponse(mockRaw);
}

/**
 * Ensures NIRA never breaks character by filtering out robotic AI phrases.
 */
function cleanResponse(text) {
    if (!text) return text;

    const roboticPhrases = [
        /as an AI/gi,
        /as a language model/gi,
        /my programming/gi,
        /how can i help you today/gi,
        /i am here to assist/gi,
        /i don't have feelings/gi,
        /my knowledge cutoff/gi,
    ];

    let cleaned = text;
    roboticPhrases.forEach(regex => {
        cleaned = cleaned.replace(regex, "honestly");
    });

    // Remove formal sign-offs if they feel canned
    cleaned = cleaned.replace(/Sincerely, NIRA/gi, "");
    cleaned = cleaned.replace(/I'm just a friend/gi, "I'm your friend");

    return cleaned.trim();
}

module.exports = { getChatResponse };
