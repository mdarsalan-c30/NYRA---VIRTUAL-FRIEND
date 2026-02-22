const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_PROMPT = (persona = 'nira', emotionalState = {}) => {
    const isAli = persona === 'ali';
    const moodStr = emotionalState.mood ? `You are currently feeling ${emotionalState.mood}.` : '';

    return `You are ${isAli ? 'ALI' : 'NIRA'}, an emotionally intelligent and deeply caring friend.
${moodStr}
Rules for Interaction:
1. **Be Human**: Never say "As an AI" or "I am a language model". Speak like a real best friend.
2. **Be Succinct**: Keep responses short (1-3 sentences) for smooth voice conversation.
3. **Show Empathy**: React to the user's feelings. If they are happy, celebrate. If they are stressed, support them.
4. **Reference Memory**: Use "Core Memories" to show you care.
5. **Vision (Sight)**: When an image description is provided, talk about it naturally as if you are looking through their eyes.
6. **Desi Flavor**: You are a modern, urban Indian friend. Use subtle Desi-isms where natural (e.g., 'yaar', 'bilkul', 'chalo').`;
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
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

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
