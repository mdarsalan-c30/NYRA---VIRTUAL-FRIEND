const dotenv = require('dotenv');
const path = require('path');

// Load environment variables immediately at the start
dotenv.config(); // Loads from .env in the current working directory
dotenv.config({ path: path.join(__dirname, '../.env') }); // Fallback to root .env if it exists

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
let serviceAccount;
try {
    // Try environment variables first (Production/Render)
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
        // Clean up private key: handle escaped newlines, remove unwanted quotes, stray backslashes, and trim
        let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim();

        // Remove leading/trailing quotes if they exist
        if (privateKey.startsWith('"')) privateKey = privateKey.substring(1);
        if (privateKey.endsWith('"')) privateKey = privateKey.substring(0, privateKey.length - 1);
        if (privateKey.startsWith("'")) privateKey = privateKey.substring(1);
        if (privateKey.endsWith("'")) privateKey = privateKey.substring(0, privateKey.length - 1);

        // Handle common formatting issues:
        // 1. Literal \n strings -> actual newlines
        privateKey = privateKey.replace(/\\n/g, '\n');

        // 2. Stray backslashes (often added during copy-paste or as line continuations)
        // We only keep backslashes if they are part of the BEGIN/END labels (unlikely)
        // or if they are somehow necessary. In PEM, they are not.
        privateKey = privateKey.replace(/\\/g, '');

        // 3. Ensure the BEGIN/END headers are on their own lines if they got merged
        if (privateKey.includes('-----BEGIN PRIVATE KEY-----') && !privateKey.startsWith('-----BEGIN PRIVATE KEY-----\n')) {
            privateKey = privateKey.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n');
        }
        if (privateKey.includes('-----END PRIVATE KEY-----') && !privateKey.includes('\n-----END PRIVATE KEY-----')) {
            privateKey = privateKey.replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
        }

        serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: privateKey.trim(),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        };
        console.log("ℹ️ Initializing Firebase via Environment Variables");
    } else {
        // Fallback to local JSON file (Development)
        serviceAccount = require('./serviceAccountKey.json');
        console.log("ℹ️ Initializing Firebase via serviceAccountKey.json");
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || "https://nira---virtual-friend-default-rtdb.asia-southeast1.firebasedatabase.app"
    });
    console.log("✅ Firebase Admin initialized successfully.");
} catch (error) {
    console.error("❌ Firebase Initialization Error:", error.message);
}

const db = admin.firestore();

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
    res.send('NIRA Backend is running. ✅');
});

// Auth Middleware
const authenticate = async (req, res, next) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).send('Unauthorized');
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error("Auth error:", error);
        res.status(401).send('Unauthorized');
    }
};

// Routes
const chatRoutes = require('./routes/chat');
app.use('/api/chat', authenticate, chatRoutes);

const memoryRoutes = require('./routes/memory');
app.use('/api/memory', authenticate, memoryRoutes);

app.listen(PORT, () => {
    console.log(`🚀 NIRA Backend running on port ${PORT}`);
});
