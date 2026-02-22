import { useState, useCallback } from 'react';
import axios from 'axios';
import { auth } from '../firebase';

export const useVoice = () => {
    const [isListening, setIsListening] = useState(false);

    const speak = useCallback(async (text, onStart, onEnd, lang = 'en', speaker = 'priya', gender = 'female') => {
        // Fallback to Browser TTS
        const browserFallback = () => {
            if (!window.speechSynthesis) return;
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            let preferredVoice;

            console.log(`🔊 [LOCAL FALLBACK] Using browser voice for: ${lang}, ${gender}`);

            if (lang === 'hi') {
                const hiVoices = voices.filter(v => v.lang.includes('hi'));
                preferredVoice = hiVoices.find(v => v.name.includes(gender === 'male' ? 'Male' : 'Female')) || hiVoices[0];
            } else {
                const enVoices = voices.filter(v => v.lang.includes('en'));
                preferredVoice = enVoices.find(v => v.name.includes(gender === 'male' ? 'Male' : 'Female')) || enVoices[0];
            }

            if (preferredVoice) {
                console.log(`✅ [LOCAL VOICE] Selected: ${preferredVoice.name}`);
                utterance.voice = preferredVoice;
            }
            utterance.onstart = onStart;
            utterance.onend = onEnd;
            utterance.onerror = onEnd;
            window.speechSynthesis.speak(utterance);
        };

        try {
            // Attempt Sarvam AI via Backend Proxy
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                console.warn("⚠️ Voice: No user token found.");
                browserFallback();
                return;
            }

            let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
            if (!apiUrl.endsWith('/api')) apiUrl += '/api';

            const targetSpeaker = speaker || (gender === 'male' ? 'rohan' : 'priya');
            console.group("🎙️ NIRA VOICE SYSTEM");
            console.log(`Endpoint: ${apiUrl}/tts`);
            console.log(`Requesting: ${targetSpeaker} (${lang})`);

            const response = await axios.post(`${apiUrl}/tts`, {
                text,
                languageCode: lang === 'hi' ? 'hi-IN' : 'en-IN',
                speaker: targetSpeaker
            }, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 20000 // Increased to 20s for Bulbul v3 generation
            });

            if (response.data && response.data.audio) {
                console.log("✅ [SARVAM SUCCESS]");
                console.groupEnd();
                if (onStart) onStart();
                const audio = new Audio(`data:audio/wav;base64,${response.data.audio}`);
                audio.onended = onEnd;
                audio.onerror = (e) => {
                    console.error("❌ Audio playback error:", e);
                    browserFallback();
                };
                await audio.play();
            } else {
                throw new Error('Sarvam returned empty audio data');
            }
        } catch (error) {
            const errorData = error.response?.data;
            const errorMsg = errorData?.details || errorData?.error || error.message;
            console.error('🛑 SARVAM ERROR:', errorMsg);
            console.groupEnd();

            // IF it's a 404, the backend proxy isn't found
            if (error.response?.status === 404) {
                console.error("CRITICAL: Backend /api/tts endpoint not found!");
            }

            browserFallback();
        }
    }, []);

    const listen = useCallback((onResult, lang = 'en') => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Speech recognition not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
        recognition.interimResults = false;
        recognition.continuous = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            setIsListening(false);
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            onResult(transcript);
        };

        recognition.start();
    }, []);

    return { speak, listen, isListening };
};
