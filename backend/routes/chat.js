const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { getChatResponse } = require('../services/gemini');
const memoryService = require('../services/MemoryService');

const AdminService = require('../services/AdminService');
const db = admin.firestore();

router.post('/', async (req, res) => {
    const { message, image } = req.body;
    const userId = req.user.uid;

    if (!message) {
        return res.status(400).send('Message is required');
    }

    try {
        // 0. ADMIN GATEKEEPER: Check for limits/emergency
        const limitCheck = await AdminService.checkLimits(userId);
        if (!limitCheck.allowed) {
            console.warn(`🛑 [Limit Reached] User ${userId}: ${limitCheck.reason}`);
            // Return a friendly message from Nira if blocked
            return res.json({ response: limitCheck.reason, blocked: true });
        }

        const profileRef = db.collection('users').doc(userId);

        // 1. Fetch memory and optionally visionary description in parallel
        const visionService = require('../services/VisionService');
        const tasks = [
            profileRef.get(),
            profileRef.collection('emotionalState').doc('current').get(),
            profileRef.collection('longTermMemory').orderBy('timestamp', 'desc').limit(10).get().catch(() => ({ docs: [] })),
            profileRef.collection('conversations').orderBy('timestamp', 'desc').limit(15).get().catch(() => ({ docs: [] })),
            memoryService.getFriendshipStats(userId)
        ];

        // If an image is provided, add vision analysis to the parallel tasks
        if (image) {
            console.log("📸 [Chat Route] Image detected, launching parallel vision analysis...");
            tasks.push(visionService.analyzeImage(image).catch(err => {
                console.warn("⚠️ Parallel Vision failed:", err.message);
                return null;
            }));
        }

        const results = await Promise.all(tasks);
        const [profileDoc, emotionalDoc, longTermSnapshot, conversationsSnapshot, stats, visionDesc] = results;

        const memory = {
            identity: profileDoc.exists ? profileDoc.data() : {},
            emotionalState: emotionalDoc.exists ? emotionalDoc.data() : {},
            longTerm: longTermSnapshot.docs.map(doc => doc.data().summary).filter(Boolean),
            recentMessages: conversationsSnapshot.docs.map(doc => doc.data()).reverse(),
            stats,
            persona: req.body.persona || 'nira',
            visionDescription: visionDesc || req.body.visionDescription // Use parallel result or manual prop
        };

        if (visionDesc) console.log(`✅ [Chat Route] Vision Success: ${visionDesc.substring(0, 30)}...`);

        // 2. Get Gemini response
        const aiResponse = await getChatResponse(message, memory);

        // 3. Return response IMMEDIATELY (Non-blocking DB saves)
        res.json({ response: aiResponse });

        // 4. Background Tasks: Save messages, update stats, emotional state, etc.
        (async () => {
            try {
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

                const profileUpdate = {
                    totalInteractions: admin.firestore.FieldValue.increment(1),
                    lastActive: admin.firestore.FieldValue.serverTimestamp()
                };
                if (!profileDoc.exists || !profileDoc.data().createdAt) {
                    profileUpdate.createdAt = admin.firestore.FieldValue.serverTimestamp();
                }
                batch.set(profileRef, profileUpdate, { merge: true });

                await batch.commit();

                // Name extraction
                const nameRegex = /(?:mera naam|my name is|i am|main|this is)\s+([a-zA-Z]{2,15})(?:\s+hai|\s+hoon|\s+here|$)/i;
                const match = message.match(nameRegex);
                if (match && match[1] && (!profileDoc.exists || !profileDoc.data().name)) {
                    const extractedName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
                    console.log(`👤 [Lazy Persistence] Name found: ${extractedName}`);
                    await profileRef.set({ name: extractedName }, { merge: true });
                }

                updateEmotionalState(userId, message, aiResponse);

                // Log Usage for Analytics
                AdminService.logUsage(userId, { type: 'chat', tokens: 1 }); // Basic count for now
            } catch (bgErr) {
                console.warn("⚠️ Background persistence failed:", bgErr.message);
            }
        })();

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
