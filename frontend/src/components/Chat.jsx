import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { useVoice } from '../hooks/useVoice';
import { Mic, Send, LogOut, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import NiraAvatar from './NiraAvatar';

const Chat = () => {
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
    const [language, setLanguage] = useState(() => localStorage.getItem('nira_lang') || 'en');
    const [persona, setPersona] = useState(() => localStorage.getItem('nira_persona') || 'nira');

    const messagesEndRef = useRef(null);
    const { speak, listen, isListening } = useVoice();

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
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleSend = async (text = input) => {
        if (!text.trim() || loading) return;
        const userMsg = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const token = await auth.currentUser.getIdToken();
            const response = await axios.post(`${API_URL}/chat`,
                { message: text },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const aiResponse = response.data.response;
            setMessages(prev => [...prev, { role: 'model', content: aiResponse }]);

            speak(aiResponse,
                () => setIsSpeaking(true),
                () => {
                    setIsSpeaking(false);
                    // Automatic voice loop: listen again if enabled
                    if (seamlessV2V) {
                        setTimeout(() => listen(handleSend, language), 800);
                    }
                },
                language,
                persona === 'ali' ? 'male' : 'female'
            );
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'error', content: 'Connection hiccup. Try again?' }]);
        } finally {
            setLoading(false);
        }
    };

    const isMobile = window.innerWidth < 768;

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

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setPersona(persona === 'nira' ? 'ali' : 'nira')} style={headerBtnStyle} title="Switch Persona">
                            {persona === 'nira' ? '👩' : '👨'}
                        </button>
                        <button onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')} style={headerBtnStyle} title="Switch Language">
                            {language === 'en' ? '🇺🇸' : '🇮🇳'}
                        </button>
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
                    </div>
                </header>
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
                    />
                </div>

                {/* Chat UI Layer */}
                <div style={{
                    position: 'absolute',
                    top: isMobile ? 'auto' : 0,
                    bottom: 0,
                    right: 0,
                    width: isMobile ? '100%' : '400px',
                    height: isMobile ? (mobileStatus ? '80%' : '0%') : '100%',
                    background: isMobile ? 'rgba(10,8,30,0.95)' : 'rgba(10,8,30,0.4)',
                    backdropFilter: 'blur(20px)',
                    borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    borderTopLeftRadius: isMobile ? '30px' : '0',
                    borderTopRightRadius: isMobile ? '30px' : '0',
                    display: 'flex', flexDirection: 'column',
                    zIndex: 10,
                    opacity: (immersionMode || !showChat) ? 0 : 1,
                    pointerEvents: (immersionMode || !showChat || (isMobile && !mobileStatus)) ? 'none' : 'auto',
                    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: (showChat || (isMobile && mobileStatus)) ? 'translateX(0)' : 'translateX(100%)',
                    boxShadow: isMobile ? '0 -10px 40px rgba(0,0,0,0.8)' : '-10px 0 30px rgba(0,0,0,0.5)',
                }}>
                    {isMobile && (
                        <div onClick={() => setMobileStatus(false)} style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '10px', margin: '15px auto', cursor: 'pointer' }} />
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
                                    border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    {msg.content}
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

                {/* Mobile FAB */}
                {isMobile && !mobileStatus && !immersionMode && (
                    <button
                        onClick={() => setMobileStatus(true)}
                        style={{
                            position: 'fixed', bottom: '30px', right: '30px', width: '60px', height: '60px',
                            borderRadius: '50%', background: '#6366f1', color: 'white', border: 'none',
                            boxShadow: '0 10px 30px rgba(99,102,241,0.5)', zIndex: 5, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        <Mic size={28} />
                    </button>
                )}
            </div>
        </div>
    );
};

const headerBtnStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'white',
    borderRadius: '10px',
    padding: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
};

const actionBtnStyle = (active, color) => ({
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    background: active ? color : 'transparent',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s',
});

export default Chat;
