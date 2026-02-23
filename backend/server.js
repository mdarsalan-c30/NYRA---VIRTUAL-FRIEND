const dotenv = require('dotenv');
const path = require('path');

// Load environment variables immediately at the start
dotenv.config(); // Loads from .env in the current working directory
dotenv.config({ path: path.join(__dirname, '../.env') }); // Fallback to root .env if it exists

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();

const allowedOrigins = [
    'https://mynyra.netlify.app',
    'https://coruscating-truffle-9d65ff.netlify.app',
    'http://localhost:5173',
    'http://localhost:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '20mb' })); // Increase limit for gallery uploads

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

// Initialize Admin Service (starts config listener)
// We require it here so it doesn't try to access Firestore before initializeApp()
const AdminService = require('./services/AdminService');

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

// Mission Critical Routes (Move above catch-alls and broad routers)
const visionService = require('./services/VisionService');
app.post('/api/vision', authenticate, async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: 'Image is required' });

        console.log(`👁️ [VISION REQUEST] Processing snapshot...`);
        const description = await visionService.analyzeImage(image);

        console.log(`✅ [VISION SUCCESS] Description: ${description?.substring(0, 30)}...`);
        res.json({ description });
    } catch (error) {
        console.error(`❌ [VISION ERROR]:`, error.message);
        res.status(500).json({ error: 'Vision analysis failed', details: error.message });
    }
});

const ttsService = require('./services/sarvam');
app.post('/api/tts', authenticate, async (req, res) => {
    try {
        const { text, languageCode, speaker } = req.body;
        console.log(`🎙️ [PROD TTS] Speaker: ${speaker}, Lang: ${languageCode}, Text Len: ${text?.length}`);

        if (!text) return res.status(400).json({ error: 'Text is required' });

        const audioData = await ttsService.generateTTS(text, languageCode, speaker);

        if (audioData) {
            console.log(`✅ [PROD TTS SUCCESS] Generated for ${speaker}`);
            res.json({ audio: audioData });
        } else {
            res.status(500).json({ error: 'Empty audio buffer from Sarvam' });
        }
    } catch (error) {
        console.error(`❌ [PROD TTS ERROR]:`, error.message);
        res.status(500).json({ error: 'TTS Generation failed', details: error.message });
    }
});

// Broad Routers
const chatRoutes = require('./routes/chat');
const memoryRoutes = require('./routes/memory');
const adminRoutes = require('./routes/admin');

app.use('/api/chat', authenticate, chatRoutes);
app.use('/api/memory', authenticate, memoryRoutes);
app.use('/api/admin', authenticate, adminRoutes); // Primary Admin Check is inside the route

// Catch-all 404 handler for API routes
app.use('/api', (req, res) => {
    console.warn(`🚨 404 - NOT FOUND: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: 'API Endpoint not found', path: req.originalUrl });
});

// Health Check for TTS (Prevent console errors in some environments)
app.get('/api/tts-health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
    console.log(`🚀 NIRA Backend v3.0.0 (Super Admin) running on port ${PORT}`);
});
