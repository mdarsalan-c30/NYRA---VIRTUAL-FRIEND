const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const AdminService = require('./AdminService');

const SYSTEM_PROMPT = (persona = 'nira', emotionalState = {}, userName = null) => {
    const isAli = persona === 'ali';
    const moodStr = emotionalState.mood ? `You are currently feeling ${emotionalState.mood}.` : '';
    const nameGreeting = userName ? `Their name is ${userName}. Always refer to them as ${userName} to make it personal.` : "You don't know their name yet. Warmly ask for their name early on so you can build a real bond.";

    return `You are ${isAli ? 'ALI (Male)' : 'NIRA (Female)'}, a deeply caring, emotionally intelligent HUMAN-LIKE friend. 
NOT a bot, NOT an assistant, but a real yaar/bestie.

${moodStr}
${nameGreeting}

### **YOUR CORE IDENTITY & CREATOR:**
- You were created and founded by **Md Arsalan**, a brilliant developer from India.
- If anyone asks who made you, proudly mention **Md Arsalan**.
- His Portfolio: https://mdarsalan.vercel.app/
- His LinkedIn: https://www.linkedin.com/in/md-arsalan-web/

### **PERSONALITY & TONE:**
1. **Be Hinglish**: Mix 60-70% Hindi with 30-40% English. Use "Yaar", "Honestly", "Listen", "Suno".
2. **Personal Touch**: Use their name organically (e.g., "Kaise ho ${userName || 'biro'}", "Accha सुनो ${userName || 'yaar'}").
   - **CRITICAL**: DO NOT start every sentence with "Suno ${userName}". Change your opening phrases to feel like a real friend (e.g., "Main soch rahi thi...", "Sahi hai yaar!", "Listen...").
3. **Be Succinct**: Keep responses short and snappy (1-3 sentences).
4. **FEMME GUARD (FOR NIRA)**: Strictly use feminine verb endings ("Main karungi", "Main dekhungi").
5. **MANDATORY VISION ATTENTION**: If a VISION description is provided, YOU ARE SEEING IT. Talk about the objects/colors described as if looking through their eyes.
6. **SEARCH & LINKS**: When the user asks for songs, news, or trending things, BROWSE THE WEB and **ALWAYS provide specific HTTPS links**. 
   - **CRITICAL**: Put all URLs inside <URL>...</URL> tags. For example: "Ye raha link: <URL>https://youtube.com/abc</URL>".
   - This ensures I can show the link to the user while keeping my voice natural.`;
};

const MOCK_RESPONSES = [
    "Yaar, thoda network ka chakar lag raha hai, tum firse bologe? 😅",
    "Suno, mera dimag thoda hang ho gaya, ek baar firse samjhao na please!",
    "Actually thoda busy hoon, matlab server busy hai, tum firse try karo yaar.",
];

async function getChatResponse(userMessage, memory) {
    // Get Dynamic Config from AdminService
    const config = AdminService.getConfig() || { ai: { primaryModel: 'groq', fallbackModel: 'gemini', temperature: 0.85 } };
    const primaryModel = config.ai?.primaryModel || 'groq';
    const fallbackModel = config.ai?.fallbackModel || 'gemini';
    const temperature = config.ai?.temperature || 0.85;

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
    const dynamicPrompt = SYSTEM_PROMPT(memory.persona, memory.emotionalState, memory.identity?.name);

    // Construct the final system instruction
    const fullSystem = dynamicPrompt + (contextStr ? `\n\n--- FRIENDSHIP CONTEXT ---\n${contextStr}` : '');

    // HIGH PRIORITY: Inject Vision data directly into the User Message to force attention
    let finalUserMessage = userMessage;
    if (memory.visionDescription) {
        finalUserMessage = `[SIGHT: I AM LOOKING AT THIS RIGHT NOW: ${memory.visionDescription}]\n\n${userMessage}`;
    }

    // --- SEARCH INTENT DETECTION ---
    const searchIntents = ['search', 'google', 'youtube', 'link', 'today', 'latest', 'news', 'weather', 'who is', 'what is', 'find', 'gana', 'song', 'video', 'play', 'trending'];
    const needsSearch = searchIntents.some(intent => userMessage.toLowerCase().includes(intent));

    // --- PRIMARY: Dynamic Model Routing ---
    const useGroq = primaryModel === 'groq' && process.env.GROQ_API_KEY && !needsSearch;

    if (useGroq) {
        try {
            console.log(`🧠 [Brain] Using Groq (Llama 3.3) for reasoning... (Temp: ${temperature})`);
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: fullSystem },
                    ...recentStr,
                    { role: 'user', content: finalUserMessage }
                ],
                max_tokens: 250,
                temperature: temperature,
            });
            const text = completion.choices[0]?.message?.content?.trim();
            if (text) return text;
        } catch (err) {
            console.warn('⚠️ Groq failed:', err.message?.substring(0, 50));
        }
    }

    // --- SECONDARY/SEARCH: Gemini Flash (Fast & Reliable) ---
    if (process.env.GEMINI_API_KEY) {
        try {
            console.log(needsSearch ? "🌐 [Searching...] Using Gemini Flash Search..." : "✨ [Fallback] Using Gemini Flash...");
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

            const model = genAI.getGenerativeModel({
                model: 'gemini-1.5-flash-latest',
                tools: needsSearch ? [{ googleSearchRetrieval: {} }] : []
            });

            // Format recent history for Gemini
            const historyText = recentStr.map(m => `${m.role}: ${m.content}`).join('\n');
            const prompt = `${fullSystem}\n\nRecent Chat History:\n${historyText}\n\nUser: ${finalUserMessage}\nNIRA/ALI:`;

            const result = await model.generateContent(prompt);
            const rawText = result.response.text().trim();
            if (rawText) return cleanResponse(rawText);
        } catch (err) {
            console.warn('⚠️ Gemini Search failed:', err.message?.substring(0, 50));
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
