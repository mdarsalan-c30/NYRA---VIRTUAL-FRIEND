const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * Middleware to protect super admin routes.
 * MD ARSALAN (Founder) check.
 */
const verifyAdmin = async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const userEmail = req.user.email?.toLowerCase();

        // --- FOUNDER ABSOLUTE ACCESS (Hardcoded Safeguard) ---
        const FOUNDER_UID = "yWTvAdxivCba14iMB5yiNoayJ8V2";
        const FOUNDER_EMAIL = "admin@nyra.ai";

        if (userId === FOUNDER_UID || userEmail === FOUNDER_EMAIL || userEmail?.includes('arsalan')) {
            console.log(`👑 [Founder Access] Authorized: ${userEmail || userId}`);

            // Auto-upgrade record in Firestore if needed
            const userRef = db.collection('users').doc(userId);
            const doc = await userRef.get();
            if (!doc.exists || doc.data().role !== 'super_admin') {
                await userRef.set({ role: 'super_admin', email: userEmail }, { merge: true });
            }

            return next();
        }

        const profileDoc = await db.collection('users').doc(userId).get();

        if (!profileDoc.exists) {
            return res.status(403).json({ error: "Access Denied: Profile not found." });
        }

        const role = profileDoc.data().role;
        const name = profileDoc.data().name?.toLowerCase();

        // Standard Role Check
        if (role === 'super_admin' || name?.includes('arsalan')) {
            console.log(`🛡️ [Admin Access] Authorized: ${name || userId}`);
            return next();
        }

        console.warn(`🚨 [Unauthorized Access Attempt] User ${userId} (${userEmail}) tried to access admin routes.`);
        return res.status(403).json({ error: "Unauthorized. Super Admin access required." });
    } catch (err) {
        console.error("❌ Admin Middleware Error:", err);
        res.status(500).json({ error: "Security check failed." });
    }
};

module.exports = verifyAdmin;
