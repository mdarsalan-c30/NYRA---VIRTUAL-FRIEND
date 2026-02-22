import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { useVoice } from '../hooks/useVoice';
import { Mic, Send, LogOut } from 'lucide-react';
import NiraAvatar from './NiraAvatar';

const Chat = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showChat, setShowChat] = useState(true);
    const messagesEndRef = useRef(null);
    const { speak, listen, isListening } = useVoice();
    const [seamlessV2V, setSeamlessV2V] = useState(true);
    const [language, setLanguage] = useState(() => localStorage.getItem('nira_lang') || 'en');
    const [persona, setPersona] = useState(() => localStorage.getItem('nira_persona') || 'nira');
    const [stats, setStats] = useState({ days: 1, interactions: 0 });

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
    }, [auth.currentUser]);

    useEffect(() => {
        localStorage.setItem('nira_lang', language);
    }, [language]);

    useEffect(() => {
        localStorage.setItem('nira_persona', persona);
    }, [persona]);

    const getBaseUrl = () => {
        let url = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        if (url.endsWith('/')) url = url.slice(0, -1);
        // Ensure /api suffix if missing
        if (!url.endsWith('/api')) url += '/api';
        return url;
    };
    const API_URL = getBaseUrl();

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    useEffect(() => { scrollToBottom(); }, [messages]);

    // AI Response Cycle
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
            const aiMsg = { role: 'model', content: aiResponse };
            setMessages(prev => [...prev, aiMsg]);

            // Sync speaking state with 3D Avatar and Voice
            speak(aiResponse,
                () => setIsSpeaking(true),
                () => {
                    setIsSpeaking(false);
                    if (seamlessV2V) {
                        setTimeout(() => listen(handleSend, language), 600);
                    }
                },
                language,
                persona === 'ali' ? 'male' : 'female'
            );
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                role: 'error',
                content: 'Connection hiccup. Try again?'
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-main)',
            fontFamily: "'Inter', sans-serif",
        }}>
            {/* Header */}
            <header style={{
                padding: '12px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--glass-border)',
                background: 'rgba(10,8,30,0.8)',
                backdropFilter: 'blur(20px)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        borderRadius: '12px',
                        padding: '8px 16px',
                        fontWeight: 800,
                        fontSize: '1.2rem',
                        letterSpacing: '0.05em',
                    }}>NIRA</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                            {isListening ? '🎤 Listening' : isSpeaking ? '💬 Speaking' : loading ? '💭 Thinking...' : '● Online'}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500, opacity: 0.8 }}>
                            {stats.days > 1 ? `Friends for ${stats.days} days` : 'First day together'}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        onClick={() => setPersona(p => p === 'nira' ? 'ali' : 'nira')}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid var(--glass-border)',
                            color: 'white',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            letterSpacing: '0.05em',
                            transition: 'all 0.3s'
                        }}
                    >
                        {persona === 'nira' ? '👩 NIRA' : '👨 ALI'}
                    </button>
                    <button
                        onClick={() => setLanguage(l => l === 'en' ? 'hi' : 'en')}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid var(--glass-border)',
                            color: 'white',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            letterSpacing: '0.05em',
                            transition: 'all 0.3s'
                        }}
                    >
                        {language === 'en' ? '🇺🇸 ENG' : '🇮🇳 HIN'}
                    </button>
                    <button
                        onClick={() => setIsFullScreen(!isFullScreen)}
                        style={{
                            background: isFullScreen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                            border: '1px solid var(--glass-border)',
                            color: 'white',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.3s'
                        }}
                    >
                        {isFullScreen ? '🗗 Window' : '🗖 Full Screen'}
                    </button>
                    <button
                        onClick={() => auth.signOut()}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                    >
                        <LogOut size={16} /> Sign out
                    </button>
                </div>
            </header>

            {/* Main Layout */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Avatar Panel */}
                <div style={{
                    position: isFullScreen ? 'absolute' : 'relative',
                    top: 0, left: 0, right: 0, bottom: 0,
                    width: isFullScreen ? '100%' : '260px',
                    minWidth: isFullScreen ? '100%' : '260px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: isFullScreen ? '0' : '24px 16px',
                    borderRight: isFullScreen ? 'none' : '1px solid var(--glass-border)',
                    background: isFullScreen ? 'black' : 'rgba(6,4,20,0.6)',
                    gap: '20px',
                    zIndex: isFullScreen ? 0 : 1,
                    transition: 'all 0.5s ease',
                }}>
                    <NiraAvatar
                        isSpeaking={isSpeaking}
                        isListening={isListening}
                        isThinking={loading}
                        isFullScreen={isFullScreen}
                        persona={persona}
                    />
                    {/* Status label - hidden in fullscreen if preferred, or made floating */}
                    {!isFullScreen && (
                        <div style={{ textAlign: 'center', padding: '0 12px' }}>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                Your personal AI friend who remembers, learns, and grows with you.
                            </p>
                        </div>
                    )}
                </div>

                {/* Chat Panel */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    position: isFullScreen ? 'absolute' : 'relative',
                    right: 0,
                    top: isFullScreen ? 'auto' : 0,
                    bottom: isFullScreen ? '100px' : 0,
                    width: isFullScreen ? '400px' : 'auto',
                    maxWidth: '100%',
                    height: isFullScreen ? '60%' : '100%',
                    background: isFullScreen ? 'rgba(10,8,30,0.4)' : 'transparent',
                    backdropFilter: isFullScreen ? 'blur(20px)' : 'none',
                    margin: isFullScreen ? '20px' : 0,
                    borderRadius: isFullScreen ? '24px' : 0,
                    border: isFullScreen ? '1px solid var(--glass-border)' : 'none',
                    zIndex: 2,
                    pointerEvents: isFullScreen && !showChat ? 'none' : 'auto',
                    opacity: isFullScreen && !showChat ? 0 : 1,
                    transition: 'all 0.4s ease',
                }}>
                    {/* Messages */}
                    <main style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                    }}>
                        {messages.length === 0 && (
                            <div style={{
                                margin: 'auto',
                                textAlign: 'center',
                                opacity: 0.5,
                                maxWidth: '300px',
                            }}>
                                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>💜</div>
                                <h3 style={{ marginBottom: '8px' }}>Say hello to NIRA</h3>
                                <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
                                    She remembers everything, listens without judgment, and is always here for you.
                                </p>
                            </div>
                        )}

                        {messages.map((msg, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                gap: '10px',
                                alignItems: 'flex-end',
                            }}>
                                {msg.role !== 'user' && (
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        flexShrink: 0,
                                    }}>N</div>
                                )}
                                <div style={{
                                    maxWidth: '70%',
                                    padding: '12px 16px',
                                    borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                                    background: msg.role === 'user'
                                        ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                        : msg.role === 'error'
                                            ? 'rgba(239,68,68,0.15)'
                                            : 'var(--bg-card)',
                                    border: msg.role === 'user' ? 'none' : '1px solid var(--glass-border)',
                                    fontSize: '0.95rem',
                                    lineHeight: 1.6,
                                    color: 'white',
                                    boxShadow: msg.role === 'user'
                                        ? '0 4px 20px rgba(99,102,241,0.3)'
                                        : '0 4px 10px rgba(0,0,0,0.2)',
                                }}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.75rem', fontWeight: 700,
                                }}>N</div>
                                <div style={{
                                    padding: '12px 18px',
                                    background: 'var(--bg-card)',
                                    borderRadius: '20px 20px 20px 4px',
                                    border: '1px solid var(--glass-border)',
                                    display: 'flex', gap: '5px', alignItems: 'center',
                                }}>
                                    {[0, 1, 2].map(i => (
                                        <div key={i} style={{
                                            width: '8px', height: '8px', borderRadius: '50%',
                                            background: '#6366f1',
                                            animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                                        }} />
                                    ))}
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </main>

                    {/* Input Bar */}
                    <footer style={{
                        padding: '16px 24px',
                        borderTop: '1px solid var(--glass-border)',
                        background: 'rgba(6,4,20,0.8)',
                        backdropFilter: 'blur(20px)',
                    }}>
                        <div style={{
                            display: 'flex',
                            gap: '10px',
                            background: 'var(--bg-card)',
                            padding: '8px',
                            borderRadius: '50px',
                            border: '1px solid var(--glass-border)',
                            maxWidth: '700px',
                            margin: '0 auto',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        }}>
                            {isFullScreen && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => setShowChat(!showChat)}
                                        title={showChat ? "Hide Chat" : "Show Chat"}
                                        style={{
                                            width: '44px', height: '44px', borderRadius: '50%',
                                            border: '1px solid var(--glass-border)', cursor: 'pointer',
                                            background: 'rgba(255,255,255,0.1)',
                                            color: 'white',
                                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                                        }}
                                    >
                                        {showChat ? '👁️' : '💬'}
                                    </button>
                                    <button
                                        onClick={() => setSeamlessV2V(!seamlessV2V)}
                                        title={seamlessV2V ? "Disable Auto-Voice" : "Enable Auto-Voice"}
                                        style={{
                                            width: '44px', height: '44px', borderRadius: '50%',
                                            border: `1px solid ${seamlessV2V ? '#10b981' : 'var(--glass-border)'}`, cursor: 'pointer',
                                            background: seamlessV2V ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.1)',
                                            color: 'white',
                                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                                            transition: 'all 0.3s',
                                        }}
                                    >
                                        {seamlessV2V ? '🎤♾️' : '🎤'}
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={() => listen(handleSend, language)}
                                title="Click to speak"
                                style={{
                                    width: '44px', height: '44px', borderRadius: '50%',
                                    border: 'none', cursor: 'pointer',
                                    background: isListening
                                        ? 'linear-gradient(135deg, #10b981, #059669)'
                                        : 'rgba(255,255,255,0.06)',
                                    color: 'white',
                                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                                    transition: 'all 0.3s',
                                    boxShadow: isListening ? '0 0 15px rgba(16,185,129,0.4)' : 'none',
                                }}
                            >
                                <Mic size={18} />
                            </button>
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                                placeholder="Talk to NIRA..."
                                style={{
                                    flex: 1, background: 'none', border: 'none',
                                    color: 'white', outline: 'none',
                                    paddingLeft: '8px', fontSize: '0.95rem',
                                }}
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={loading || !input.trim()}
                                style={{
                                    width: '44px', height: '44px', borderRadius: '50%',
                                    border: 'none', cursor: 'pointer',
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: 'white',
                                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                                    opacity: (loading || !input.trim()) ? 0.5 : 1,
                                    transition: 'all 0.2s',
                                    boxShadow: '0 4px 15px rgba(99,102,241,0.4)',
                                }}
                            >
                                <Send size={16} />
                            </button>
                        </div>
                        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px', opacity: 0.5 }}>
                            🎤 Voice enabled • 💜 Powered by Groq AI
                        </p>
                    </footer>
                </div>
            </div>

            <style>{`
                @keyframes bounce {
                    0%, 60%, 100% { transform: translateY(0); }
                    30% { transform: translateY(-6px); }
                }
                ::-webkit-scrollbar { width: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 2px; }
            `}</style>
        </div>
    );
};

export default Chat;
