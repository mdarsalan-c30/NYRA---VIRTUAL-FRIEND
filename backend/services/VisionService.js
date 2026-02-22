const { GoogleGenerativeAI } = require('@google/generative-ai');

class VisionService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Use Gemini 1.5 Flash for fast vision analysis
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }

    /**
     * Analyzes a base64 image and returns a natural description.
     */
    async analyzeImage(base64Image) {
        if (!base64Image) return null;

        try {
            // Remove data URI prefix if present
            const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

            const prompt = `
                You are the eyes of an AI friend named NIRA.
                Look at this image from your friend's camera.
                Describe what you see in a natural, friendly, and observant way.
                Focus on:
                - The user's expression/mood.
                - Interestingly objects in the room.
                - Any activities or specific things they are showing you.
                Keep it to 2-3 sentences. Talk as if you are seeing it RIGHT NOW.
            `;

            const imagePart = {
                inlineData: {
                    data: cleanBase64,
                    mimeType: "image/jpeg",
                },
            };

            const result = await this.model.generateContent([prompt, imagePart]);
            const response = await result.response;
            return response.text().trim();
        } catch (error) {
            console.error("❌ Vision Analysis Error:", error.message);
            throw error;
        }
    }
}

module.exports = new VisionService();
