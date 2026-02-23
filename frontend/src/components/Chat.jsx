import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { useVoice } from '../hooks/useVoice';
import { Mic, Send, LogOut, Maximize2, Minimize2, Sparkles, MessageCircle, Camera, CameraOff, Image as ImageIcon } from 'lucide-react';
import NiraAvatar from './NiraAvatar';
import { cameraService } from '../services/CameraService';

const Chat = ({ isAdmin, onOpenAdmin }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [immersionMode, setImmersionMode] = useState(false);
    const [mobileStatus, setMobileStatus] = useState(false); // Controls chat drawer on mobile
    const [seamlessV2V, setSeamlessV2V] = useState(true);
    const [showChat, setShowChat] = useState(window.innerWidth > 1024); // Show by default on large screens
    const [stats, setStats] = useState({ days: 1, interactions: 0 });
    const isMobile = window.innerWidth < 768;
    const [language, setLanguage] = useState(() => localStorage.getItem('nira_lang') || (isMobile ? 'hi' : 'en'));
    const [persona, setPersona] = useState(() => localStorage.getItem('nira_persona') || 'nira');
    const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem('nira_voice') || (isMobile ? 'ritu' : (persona === 'ali' ? 'rohan' : 'priya')));
    const [showSettings, setShowSettings] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [visionLoading, setVisionLoading] = useState(false);
    const [visionContext, setVisionContext] = useState(null);

    const messagesEndRef = useRef(null);
    const videoRef = useRef(null);
    const fileInputRef = useRef(null);
    const { speak, listen, isListening } = useVoice();

    const voices = {
        female: ['priya', 'ritu', 'pooja', 'neha', 'simran', 'kavya'],
        male: ['rohan', 'aditya', 'rahul', 'amit', 'dev', 'varun']
    };

    useEffect(() => {
        // Reset voice when persona changes if the current voice doesn't match the new gender
        const currentCategory = voices.female.includes(selectedVoice) ? 'female' : 'male';
        const targetCategory = persona === 'ali' ? 'male' : 'female';
        if (currentCategory !== targetCategory) {
            const nextVoice = targetCategory === 'male' ? 'rohan' : 'priya';
            setSelectedVoice(nextVoice);
        }
    }, [persona]);

    const getBaseUrl = () => {
        let url = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        if (url.endsWith('/')) url = url.slice(0, -1);
        if (!url.endsWith('/api')) url += '/api';
        return url;
    };
    const API_URL = getBaseUrl();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = await auth.currentUser.getIdToken();
                const response = await axios.get(`${API_URL}/memory`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.data.stats) setStats(response.data.stats);
            } catch (error) {
                console.error("Failed to fetch stats:", error);
            }
        };
        if (auth.currentUser) fetchStats();
    }, [auth.currentUser, API_URL]);

    useEffect(() => { localStorage.setItem('nira_lang', language); }, [language]);
    useEffect(() => { localStorage.setItem('nira_persona', persona); }, [persona]);
    useEffect(() => { localStorage.setItem('nira_voice', selectedVoice); }, [selectedVoice]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const VERSION = "3.0.0";
    useEffect(() => {
        console.log(`%c 🚀 NIRA SYSTEM v${VERSION} ACTIVE `, 'background: #6366f1; color: white; font-weight: bold; font-size: 1.2rem; padding: 4px; border-radius: 4px;');
    }, []);

    const handleSend = async (textOverride = null, imageOverride = null) => {
        const textToSubmit = (textOverride !== null ? textOverride : input).trim();
        if ((!textToSubmit && !imageOverride) || loading) return;

        // Add user message with image to history
        const userMsg = {
            role: 'user',
            content: textToSubmit,
            image: imageOverride || null // Store the image if provided
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const token = await auth.currentUser.getIdToken();

            // Capture snapshot if camera is on AND no image was provided
            let snapshot = imageOverride;
            if (!snapshot && isCameraOn && videoRef.current) {
                try {
                    snapshot = cameraService.takeSnapshot(videoRef.current);
                    setVisionLoading(true);
                } catch (vErr) {
                    console.warn("Vision capture failed:", vErr);
                }
            }

            const response = await axios.post(`${API_URL}/chat`, {
                message: textToSubmit,
                persona: persona,
                image: snapshot
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const aiResponse = response.data.response;
            const newAiMsg = { role: 'model', content: aiResponse };
            setMessages(prev => [...prev, newAiMsg]);

            // Clear vision loading if it was set
            setVisionLoading(false);

            // Trigger Voice
            if (seamlessV2V) {
                setIsSpeaking(true);
                speak(aiResponse,
                    () => setIsSpeaking(true),
                    () => {
                        setIsSpeaking(false);
                        // AUTO-LOOP: Restart listening after she finishes speaking
                        if (seamlessV2V) listen(handleSend, language);
                    },
                    language,
                    selectedVoice,
                    persona === 'ali' ? 'male' : 'female'
                );
            }
        } catch (error) {
            console.error('Chat error:', error);
            const errorMsg = { role: 'model', content: "Mafi chahti hoon, thoda network ka issue lag raha hai. Kya tum firse bol sakte ho? 🙏" };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
            setVisionLoading(false);
        }
    };

    const toggleCamera = async () => {
        if (isCameraOn) {
            cameraService.stopCamera();
            setIsCameraOn(false);
        } else {
            try {
                const stream = await cameraService.startCamera();
                setIsCameraOn(true);
                setTimeout(() => {
                    if (videoRef.current) videoRef.current.srcObject = stream;
                }, 100);
            } catch (err) {
                alert("Could not access camera. Please check permissions.");
            }
        }
    };

    const handleGalleryClick = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const compressImage = (base64Str, maxWidth = 800) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compressing to 70% quality
            };
        });
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const rawBase64 = event.target.result;
            setVisionLoading(true);
            try {
                // Compress before sending
                const base64 = await compressImage(rawBase64);

                // Directly send to chat for parallel analysis
                await handleSend(`Hey Nira, look at this picture I just uploaded.`, base64);
            } catch (err) {
                console.error("Gallery upload failed:", err);
                alert("Failed to analyze image.");
            } finally {
                setVisionLoading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const niraLook = async () => {
        if (!isCameraOn) {
            alert("Turn on NIRA Sight (Camera) first!");
            return;
        }

        // Capture and send immediately
        try {
            setVisionLoading(true);
            const snapshot = cameraService.takeSnapshot(videoRef.current);
            await handleSend("What do you see right now?", snapshot);
        } catch (err) {
            console.error("NIRA Look failed:", err);
            handleSend("What do you see right now?");
        } finally {
            setVisionLoading(false);
        }
    };

    const headerBtnStyle = {
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        padding: '6px 10px',
        color: 'white',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        fontSize: '0.8rem',
        fontWeight: 500,
    };

    const actionBtnStyle = (isActive, color) => ({
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        border: 'none',
        background: isActive ? color : 'rgba(255,255,255,0.1)',
        color: 'white',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
    });

    const settingItemStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        color: 'white',
    };

    const settingLabelStyle = {
        fontSize: '0.8rem',
        color: 'rgba(255,255,255,0.5)',
        fontWeight: 600,
        marginBottom: '10px',
        textTransform: 'uppercase'
    };

    const appBtnStyle = (isActive) => ({
        padding: '15px 20px',
        borderRadius: '15px',
        border: isActive ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
        background: isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
        color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
        fontSize: '0.9rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        textAlign: 'center',
        flex: 1
    });

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'black',
            fontFamily: "'Inter', sans-serif",
            overflow: 'hidden',
        }}>
            {/* Nav Header */}
            {!immersionMode && (
                <header style={{
                    padding: '8px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(10,8,30,0.8)',
                    backdropFilter: 'blur(20px)',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    position: 'fixed',
                    top: 0, left: 0, right: 0,
                    zIndex: 100,
                    transition: 'opacity 0.4s ease',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontWeight: 800,
                            fontSize: '1rem',
                            color: 'white'
                        }}>NIRA</div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                                {isListening ? '🎤 Listening' : isSpeaking ? '💬 Speaking' : loading ? '💭 Thinking' : '● Online'}
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {/* Desktop Only Voice Selector */}
                        {!isMobile && (
                            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '2px 8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginRight: '6px', alignSelf: 'center' }}>VOICE</span>
                                <select
                                    value={selectedVoice}
                                    onChange={(e) => setSelectedVoice(e.target.value)}
                                    style={{ background: 'none', border: 'none', color: 'white', fontSize: '0.8rem', outline: 'none', cursor: 'pointer', padding: '4px 0' }}
                                >
                                    {(persona === 'ali' ? voices.male : voices.female).map(v => (
                                        <option key={v} value={v} style={{ background: '#0a081e', color: 'white', textTransform: 'capitalize' }}>
                                            {v.charAt(0).toUpperCase() + v.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {!isMobile && (
                            <>
                                <button
                                    onClick={() => speak("Namaste, I am testing your selected voice.", null, null, language, selectedVoice, persona === 'ali' ? 'male' : 'female')}
                                    style={{ ...headerBtnStyle, fontSize: '0.7rem', color: '#8b5cf6' }}
                                    title="Test Current Voice"
                                >
                                    TEST
                                </button>
                                <button onClick={toggleCamera} style={headerBtnStyle} title="Toggle Camera">
                                    {isCameraOn ? <CameraOff size={16} color="#ef4444" /> : <Camera size={16} />}
                                </button>
                                <button onClick={() => setPersona(persona === 'nira' ? 'ali' : 'nira')} style={headerBtnStyle} title="Switch Persona">
                                    {persona === 'nira' ? '👩' : '👨'}
                                </button>
                                <button onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')} style={headerBtnStyle} title="Switch Language">
                                    {language === 'en' ? '🇺🇸' : '🇮🇳'}
                                </button>
                                {isAdmin && (
                                    <button onClick={onOpenAdmin} style={{ ...headerBtnStyle, color: '#818cf8', border: '1px solid rgba(129, 140, 248, 0.3)', background: 'rgba(129, 140, 248, 0.1)' }} title="System Control">
                                        🛡️
                                    </button>
                                )}
                                <button onClick={() => setSeamlessV2V(!seamlessV2V)} style={{ ...headerBtnStyle, color: seamlessV2V ? '#10b981' : 'white' }} title="Toggle Auto-Voice Loop">
                                    {seamlessV2V ? '🎤♾️' : '🎤'}
                                </button>
                                <button onClick={() => setImmersionMode(true)} style={headerBtnStyle} title="Focus Mode">
                                    <Sparkles size={16} />
                                </button>
                                <button onClick={() => setShowChat(!showChat)} style={headerBtnStyle} title="Toggle Chat Panel">
                                    {showChat ? '📖' : '💬'}
                                </button>
                                <button onClick={() => setIsFullScreen(!isFullScreen)} style={headerBtnStyle}>
                                    {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                </button>
                                <button onClick={() => auth.signOut()} style={{ ...headerBtnStyle, background: 'none', border: 'none' }}>
                                    <LogOut size={16} />
                                </button>
                            </>
                        )}

                        {isMobile && (
                            <button onClick={() => setShowSettings(true)} style={{ ...headerBtnStyle, padding: '8px 16px', borderRadius: '20px', background: '#6366f1', border: 'none', fontWeight: 700 }}>
                                MENU
                            </button>
                        )}
                    </div>
                </header>
            )}

            {/* Mobile Settings Overlay (App Style) */}
            {showSettings && isMobile && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(10,8,30,0.95)', backdropFilter: 'blur(20px)',
                    display: 'flex', flexDirection: 'column'
                }}>
                    <div style={{ padding: '40px 25px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h1 style={{ color: 'white', margin: 0, fontSize: '2rem', fontWeight: 900 }}>Settings</h1>
                        <button onClick={() => setShowSettings(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', fontSize: '1.2rem' }}>✕</button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 25px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
                        <div style={settingItemStyle}>
                            <span style={settingLabelStyle}>VOICE</span>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                                {(persona === 'ali' ? voices.male : voices.female).map(v => (
                                    <button
                                        key={v}
                                        onClick={() => setSelectedVoice(v)}
                                        style={appBtnStyle(selectedVoice === v)}
                                    >
                                        {v.charAt(0).toUpperCase() + v.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={settingItemStyle}>
                            <span style={settingLabelStyle}>PERSONALITY</span>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => setPersona('nira')} style={appBtnStyle(persona === 'nira')}>NIRA 👩</button>
                                <button onClick={() => setPersona('ali')} style={appBtnStyle(persona === 'ali')}>ALI 👨</button>
                            </div>
                        </div>

                        <div style={settingItemStyle}>
                            <span style={settingLabelStyle}>LANGUAGE</span>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => setLanguage('hi')} style={appBtnStyle(language === 'hi')}>HINDI 🇮🇳</button>
                                <button onClick={() => setLanguage('en')} style={appBtnStyle(language === 'en')}>ENGLISH 🇺🇸</button>
                            </div>
                        </div>

                        <div style={settingItemStyle}>
                            <span style={settingLabelStyle}>IMMERSION</span>
                            <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                                <button onClick={() => setSeamlessV2V(!seamlessV2V)} style={appBtnStyle(seamlessV2V)}>
                                    AUTO-VOICE LOOP: {seamlessV2V ? 'ON' : 'OFF'}
                                </button>
                                <button onClick={() => { setImmersionMode(true); setShowSettings(false); }} style={{ ...appBtnStyle(false), color: '#8b5cf6' }}>
                                    FULL AVATAR MODE 🌌
                                </button>
                                {isAdmin && (
                                    <button onClick={() => { onOpenAdmin(); setShowSettings(false); }} style={{ ...appBtnStyle(false), background: 'rgba(129, 140, 248, 0.2)', border: '1px solid #818cf8', color: '#818cf8', marginTop: '10px' }}>
                                        SYSTEM CONTROL (ADMIN) 🛡️
                                    </button>
                                )}
                                <button onClick={toggleCamera} style={{ ...appBtnStyle(isCameraOn), color: isCameraOn ? '#ee4444' : '#10b981' }}>
                                    NIRA SIGHT (CAMERA): {isCameraOn ? 'ON' : 'OFF'}
                                </button>
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', paddingBottom: '40px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '15px' }}>
                                <div style={{ flex: 1, textAlign: 'center' }}><div style={{ color: 'white', fontWeight: 800 }}>{stats.days}</div><div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)' }}>DAYS</div></div>
                                <div style={{ flex: 1, textAlign: 'center' }}><div style={{ color: 'white', fontWeight: 800 }}>{stats.interactions}</div><div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)' }}>HITS</div></div>
                            </div>
                            <button onClick={() => auth.signOut()} style={{ padding: '15px', borderRadius: '15px', border: '1px solid #ef4444', color: '#ef4444', background: 'none', fontWeight: 700 }}>SIGN OUT</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Immersion Mode Controls Overlay */}
            {immersionMode && (
                <div style={{
                    position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
                }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                        backdropFilter: 'blur(20px)', padding: '8px 16px', borderRadius: '40px',
                        display: 'flex', gap: '12px', alignItems: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                    }}>
                        <button onClick={() => setSeamlessV2V(!seamlessV2V)} style={{ ...headerBtnStyle, background: 'none', border: 'none', color: seamlessV2V ? '#10b981' : 'white' }}>
                            {seamlessV2V ? '🎤 Loop On' : '🎤 Loop Off'}
                        </button>
                        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />
                        <button onClick={niraLook} style={{ ...headerBtnStyle, background: 'none', border: 'none', color: '#6366f1' }}>
                            👁️ NIRA Look
                        </button>
                        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />
                        <button
                            onClick={() => listen(handleSend, language)}
                            style={{
                                width: '44px', height: '44px', borderRadius: '50%', border: 'none',
                                background: isListening ? '#ef4444' : '#6366f1', color: 'white', cursor: 'pointer'
                            }}
                        >
                            <Mic size={20} />
                        </button>
                        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />
                        <button onClick={() => setPersona(persona === 'nira' ? 'ali' : 'nira')} style={{ ...headerBtnStyle, background: 'none', border: 'none' }}>
                            {persona === 'nira' ? '👩' : '👨'}
                        </button>
                    </div>
                    <button
                        onClick={() => setImmersionMode(false)}
                        style={{
                            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                            fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline'
                        }}
                    >
                        Exit Focus Mode
                    </button>
                </div>
            )}

            {/* Main Stage */}
            <div style={{
                flex: 1, position: 'relative', marginTop: immersionMode ? 0 : '50px',
                display: 'flex', overflow: 'hidden'
            }}>
                {/* 3D Avatar Background */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 0, background: 'black'
                }}>
                    <NiraAvatar
                        isSpeaking={isSpeaking}
                        isListening={isListening}
                        isThinking={loading}
                        isFullScreen={true}
                        persona={persona}
                        immersionMode={immersionMode}
                    />
                </div>

                {/* Camera Feed Context (Floating Preview) */}
                {isCameraOn && (
                    <div style={{
                        position: 'absolute', top: '100px', left: '20px',
                        width: '120px', height: '160px', borderRadius: '15px',
                        border: '2px solid rgba(255,255,255,0.2)', overflow: 'hidden',
                        zIndex: 500, boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        background: 'black', transition: 'all 0.3s ease',
                        opacity: immersionMode ? 0.3 : 1
                    }}>
                        <video
                            ref={videoRef} autoPlay playsInline muted
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {visionLoading && (
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                background: 'rgba(99,102,241,0.3)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', color: 'white'
                            }}>
                                <Sparkles size={20} className="animate-pulse" />
                            </div>
                        )}
                    </div>
                )}

                {/* Chat UI Layer */}
                <div style={{
                    position: 'absolute',
                    top: isMobile ? 'auto' : 0,
                    bottom: 0,
                    right: 0,
                    width: isMobile ? '100%' : '400px',
                    height: isMobile ? (mobileStatus ? '75%' : '0%') : '100%',
                    background: isMobile ? 'rgba(10,8,30,0.98)' : 'rgba(10,8,30,0.4)',
                    backdropFilter: 'blur(30px)',
                    borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    borderTopLeftRadius: isMobile ? '40px' : '0',
                    borderTopRightRadius: isMobile ? '40px' : '0',
                    display: 'flex', flexDirection: 'column',
                    zIndex: 200, // Above settings if needed
                    opacity: immersionMode ? 0 : (isMobile && !mobileStatus ? 0 : 1),
                    pointerEvents: (immersionMode || (isMobile && !mobileStatus)) ? 'none' : 'auto',
                    transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                    transform: (isMobile)
                        ? (mobileStatus ? 'translateY(0)' : 'translateY(100%)')
                        : (showChat ? 'translateX(0)' : 'translateX(100%)'),
                    boxShadow: isMobile ? '0 -20px 60px rgba(0,0,0,0.9)' : '-10px 0 30px rgba(0,0,0,0.5)',
                }}>
                    {isMobile && (
                        <div
                            onClick={() => setMobileStatus(false)}
                            style={{
                                width: '60px', height: '6px', background: 'rgba(255,255,255,0.15)',
                                borderRadius: '10px', margin: '12px auto', cursor: 'pointer',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}
                        />
                    )}

                    <main style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {messages.length === 0 && (
                            <div style={{ margin: 'auto', textAlign: 'center', opacity: 0.3 }}>
                                <Sparkles size={40} style={{ marginBottom: '10px' }} />
                                <p>Conversation with {persona === 'nira' ? 'Nira' : 'Ali'}</p>
                            </div>
                        )}
                        {messages.map((msg, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                <div style={{
                                    maxWidth: '85%', padding: '12px 16px', borderRadius: '20px',
                                    background: msg.role === 'user' ? '#6366f1' : 'rgba(255,255,255,0.08)',
                                    color: 'white', fontSize: '0.9rem', lineHeight: 1.4,
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    display: 'flex', flexDirection: 'column', gap: '8px'
                                }}>
                                    {msg.image && (
                                        <img
                                            src={msg.image}
                                            alt="Uploaded context"
                                            style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                                        />
                                    )}
                                    {msg.content && <div>{msg.content}</div>}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </main>

                    <footer style={{ padding: '20px', background: 'rgba(0,0,0,0.2)' }}>
                        <div style={{
                            display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)',
                            padding: '6px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <button onClick={() => listen(handleSend, language)} style={actionBtnStyle(isListening, '#ef4444')}>
                                <Mic size={20} />
                            </button>
                            <button onClick={toggleCamera} style={actionBtnStyle(isCameraOn, '#10b981')}>
                                <Camera size={20} />
                            </button>
                            <button onClick={handleGalleryClick} style={actionBtnStyle(false, '#8b5cf6')}>
                                <ImageIcon size={20} />
                            </button>
                            <input
                                type="file" ref={fileInputRef}
                                style={{ display: 'none' }} accept="image/*"
                                onChange={handleFileChange}
                            />
                            <input
                                type="text" value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                                placeholder="Whisper something..."
                                style={{ flex: 1, background: 'none', border: 'none', color: 'white', outline: 'none', fontSize: '0.95rem' }}
                            />
                            <button onClick={() => handleSend()} style={actionBtnStyle(false, '#6366f1')}>
                                <Send size={18} />
                            </button>
                        </div>
                    </footer>
                </div>

                {/* Floating Chat Toggle (Desktop) */}
                {!isMobile && !showChat && !immersionMode && (
                    <button
                        onClick={() => setShowChat(true)}
                        style={{
                            position: 'absolute', top: '20px', right: '20px',
                            background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
                            color: 'white', padding: '10px 20px', borderRadius: '30px', cursor: 'pointer',
                            zIndex: 5, backdropFilter: 'blur(10px)', fontWeight: 600, transition: 'all 0.3s'
                        }}
                    >
                        💬 Show Chat
                    </button>
                )}

                {/* Mobile FAB - Mic only */}
                {isMobile && !mobileStatus && !immersionMode && (
                    <div style={{
                        position: 'fixed', bottom: '40px', left: '0', right: '0',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none'
                    }}>
                        <button
                            onClick={() => listen(handleSend, language)}
                            style={{
                                width: '85px', height: '85px',
                                borderRadius: '50%', background: isListening ? '#ef4444' : '#6366f1', color: 'white', border: 'none',
                                boxShadow: `0 20px 40px ${isListening ? 'rgba(239,68,68,0.5)' : 'rgba(99,102,241,0.5)'}`,
                                zIndex: 150, cursor: 'pointer', pointerEvents: 'auto',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                animation: isListening ? 'pulse-mic 1.5s infinite' : 'none',
                                border: '2px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            <Mic size={38} />
                        </button>
                    </div>
                )}

                {/* Mobile FAB - Chat Drawer Toggle */}
                {isMobile && !mobileStatus && !immersionMode && (
                    <button
                        onClick={() => setMobileStatus(true)}
                        style={{
                            position: 'fixed', bottom: '57px', right: '25px', width: '55px', height: '55px',
                            borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: 'white',
                            border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(20px)',
                            zIndex: 150, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                        }}
                    >
                        <MessageCircle size={24} />
                    </button>
                )}

                <style>{`
                @keyframes pulse-mic {
                    0% { transform: translateX(-50%) scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                    70% { transform: translateX(-50%) scale(1.1); box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
                    100% { transform: translateX(-50%) scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                }
            `}</style>
            </div>
        </div>
    );
};

export default Chat;
