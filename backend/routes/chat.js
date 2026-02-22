const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { getChatResponse } = require('../services/gemini');
const memoryService = require('../services/MemoryService');

const db = admin.firestore();

router.post('/', async (req, res) => {
    const { message } = req.body;
    const userId = req.user.uid;

    if (!message) {
        return res.status(400).send('Message is required');
    }

    try {
        // 1. Fetch user data in parallel
        const profileRef = db.collection('users').doc(userId);

        const [profileDoc, emotionalDoc, longTermSnapshot, conversationsSnapshot, stats] = await Promise.all([
            profileRef.get(),
            profileRef.collection('emotionalState').doc('current').get(),
            profileRef.collection('longTermMemory').orderBy('timestamp', 'desc').limit(10).get().catch(() => ({ docs: [] })),
            profileRef.collection('conversations').orderBy('timestamp', 'desc').limit(15).get().catch(() => ({ docs: [] })),
            memoryService.getFriendshipStats(userId)
        ]);

        const memory = {
            identity: profileDoc.exists ? profileDoc.data() : {},
            emotionalState: emotionalDoc.exists ? emotionalDoc.data() : {},
            longTerm: longTermSnapshot.docs.map(doc => doc.data().summary).filter(Boolean),
            recentMessages: conversationsSnapshot.docs.map(doc => doc.data()).reverse(),
            stats,
            persona: req.body.persona || 'nira', // Allow frontend to specify persona
            visionDescription: req.body.visionDescription // Support for vision-enabled chats
        };

        console.log(`Fetched memory for ${userId}. Messages: ${memory.recentMessages.length}, Facts: ${memory.longTerm.length}`);

        // 2. Get Gemini response
        const aiResponse = await getChatResponse(message, memory);

        // 3. Save messages in a batch
        const batch = db.batch();
        const userMsgRef = profileRef.collection('conversations').doc();
        batch.set(userMsgRef, {
            role: 'user',
            content: message,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        const aiMsgRef = profileRef.collection('conversations').doc();
        batch.set(aiMsgRef, {
            role: 'model',
            content: aiResponse,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update interaction count and metadata
        const profileUpdate = {
            totalInteractions: admin.firestore.FieldValue.increment(1),
            lastActive: admin.firestore.FieldValue.serverTimestamp()
        };
        // Set createdAt if it doesn't exist (only happens once)
        if (!profileDoc.exists || !profileDoc.data().createdAt) {
            profileUpdate.createdAt = admin.firestore.FieldValue.serverTimestamp();
        }
        batch.set(profileRef, profileUpdate, { merge: true });

        await batch.commit();

        // 4. Return response
        res.json({ response: aiResponse });

        // 5. Fire-and-forget: update emotional state & extract facts
        updateEmotionalState(userId, message, aiResponse);

        // Only extract facts every few messages or if the message is long/significant
        if (memory.recentMessages.length % 5 === 0 || message.length > 40) {
            memoryService.extractFacts(userId, [...memory.recentMessages, { role: 'user', content: message }, { role: 'model', content: aiResponse }]);
        }

    } catch (error) {
        console.error("Chat route error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

async function updateEmotionalState(userId, userMsg, aiResponse) {
    try {
        const profileRef = db.collection('users').doc(userId);
        const mood = userMsg.length > 50 ? 'reflective' : userMsg.toLowerCase().includes('stress') ? 'stressed' : 'engaged';
        await profileRef.collection('emotionalState').doc('current').set({
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            mood,
            energy: 'high'
        }, { merge: true });
    } catch (e) {
        console.error("Emotional state update failed:", e.message);
    }
}

module.exports = router;
