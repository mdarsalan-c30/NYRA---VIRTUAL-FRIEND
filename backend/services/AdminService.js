const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * AdminService handles global system configuration, usage tracking, and cost analytics.
 * It uses a singleton pattern to keep the systemConfig in memory for fast access.
 */
class AdminService {
    constructor() {
        this.config = null;
        this.configListener = null;
        this.usageBuffer = [];
        this.init();
    }

    async init() {
        console.log("🛠️ [AdminService] Initializing Global Config Listener...");
        const configRef = db.collection('systemConfig').doc('global');

        // Setup Real-time listener so we don't have to query Firestore on every chat message
        this.configListener = configRef.onSnapshot(doc => {
            if (doc.exists) {
                this.config = doc.data();
                console.log("✅ [AdminService] Global Config Updated:", JSON.stringify(this.config));
            } else {
                // Initialize default config if it doesn't exist
                const defaultConfig = {
                    maxMessagesPerUser: 50,
                    maxSystemMessagesPerDay: 5000,
                    features: {
                        searchEnabled: true,
                        ttsEnabled: true,
                        visionEnabled: true
                    },
                    ai: {
                        primaryModel: 'groq',
                        fallbackModel: 'gemini',
                        temperature: 0.85,
                        challengeLevel: 5,
                        emotionalDepth: 7
                    },
                    emergency: {
                        killSwitch: false,
                        maintenanceMode: false
                    }
                };
                configRef.set(defaultConfig);
                this.config = defaultConfig;
                console.log("🆕 [AdminService] Default Config Created.");
            }
        });
    }

    getConfig() {
        return this.config;
    }

    /**
     * Logs usage for cost estimation and analytics.
     * @param {string} userId 
     * @param {Object} usageData { type: 'groq'|'gemini'|'sarvam', tokens: number, details: string }
     */
    async logUsage(userId, usageData) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const usageRef = db.collection('usageMetrics').doc(today);

            const field = `stats.${usageData.type}`;
            const countField = `counts.${usageData.type}`;

            await usageRef.set({
                [field]: admin.firestore.FieldValue.increment(usageData.tokens || 1),
                [countField]: admin.firestore.FieldValue.increment(1),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // User-specific daily counter
            const userLimitRef = db.collection('users').doc(userId).collection('dailyLimits').doc(today);
            await userLimitRef.set({
                messageCount: admin.firestore.FieldValue.increment(usageData.type === 'chat' ? 1 : 0),
                lastActive: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

        } catch (err) {
            console.warn("⚠️ [AdminService] Usage logging failed:", err.message);
        }
    }

    /**
     * Checks if a user or the system has reached a limit.
     */
    async checkLimits(userId) {
        if (!this.config) return { allowed: true };
        if (this.config.emergency?.killSwitch) return { allowed: false, reason: "System is in emergency maintenance mode." };

        const today = new Date().toISOString().split('T')[0];
        const userLimitDoc = await db.collection('users').doc(userId).collection('dailyLimits').doc(today).get();

        if (userLimitDoc.exists) {
            const currentCount = userLimitDoc.data().messageCount || 0;
            if (currentCount >= this.config.maxMessagesPerUser) {
                return { allowed: false, reason: "Daily limit reached. Nira is resting now, try again tomorrow! 🌙" };
            }
        }

        return { allowed: true };
    }
}

module.exports = new AdminService();
