const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const db = admin.firestore();
const AdminService = require('../services/AdminService');
const verifyAdmin = require('../middleware/admin');

/**
 * Super Admin Dashboard Routes
 * All routes are protected by verifyAdmin middleware (Founder Only)
 */

// 1. Get Dashboard Stats
router.get('/stats', verifyAdmin, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const usageMetrics = await db.collection('usageMetrics').doc(today).get();
        const usersSnapshot = await db.collection('users').count().get();
        
        const stats = {
            activeUsers: usersSnapshot.data().count,
            usage: usageMetrics.exists ? usageMetrics.data() : { stats: {}, counts: {} },
            config: AdminService.getConfig()
        };
        
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. List Users for Moderation
router.get('/users', verifyAdmin, async (req, res) => {
    try {
        const usersSnapshot = await db.collection('users').limit(100).get();
        const users = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Update Global Configuration
router.post('/config', verifyAdmin, async (req, res) => {
    try {
        const newConfig = req.body;
        await db.collection('systemConfig').doc('global').set(newConfig, { merge: true });
        res.json({ success: true, message: "Config updated successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Emergency Kill Switch / Toggle Features
router.post('/kill-switch', verifyAdmin, async (req, res) => {
    try {
        const { target, enabled } = req.body; // e.g., target: 'emergency.killSwitch', enabled: true
        const update = {};
        update[target] = enabled;
        
        await db.collection('systemConfig').doc('global').update(update);
        res.json({ success: true, target, enabled });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. User Moderation (Suspend/Activate)
router.post('/user/moderate', verifyAdmin, async (req, res) => {
    try {
        const { userId, action } = req.body;
        const userRef = db.collection('users').doc(userId);
        
        if (action === 'suspend') {
            await userRef.update({ isSuspended: true });
        } else if (action === 'activate') {
            await userRef.update({ isSuspended: false });
        }
        
        res.json({ success: true, userId, action });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
