import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    LayoutDashboard,
    Users,
    Cpu,
    Zap,
    Activity,
    Power,
    Lock,
    RefreshCcw,
    Save,
    AlertTriangle,
    ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api';

const AdminDashboard = ({ user, onExit }) => {
    const [activeTab, setActiveTab] = useState('stats');
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(null);

    useEffect(() => {
        const init = async () => {
            if (user) {
                const idToken = await user.getIdToken();
                setToken(idToken);
                fetchStats(idToken);
                fetchUsers(idToken);
            }
        };
        init();
    }, [user]);

    const fetchStats = async (t) => {
        try {
            const res = await axios.get(`${API_URL}/admin/stats`, {
                headers: { Authorization: `Bearer ${t}` }
            });
            setStats(res.data);
            setConfig(res.data.config);
            setLoading(false);
        } catch (err) {
            console.error("Stats fail:", err);
        }
    };

    const fetchUsers = async (t) => {
        try {
            const res = await axios.get(`${API_URL}/admin/users`, {
                headers: { Authorization: `Bearer ${t}` }
            });
            setUsers(res.data);
        } catch (err) {
            console.error("Users fail:", err);
        }
    };

    const handleConfigSave = async (updatedConfig) => {
        try {
            await axios.post(`${API_URL}/admin/config`, updatedConfig, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchStats(token);
            alert("Config Saved Successfully! 🚀");
        } catch (err) {
            alert("Save failed.");
        }
    };

    const toggleKillSwitch = async (target, enabled) => {
        try {
            await axios.post(`${API_URL}/admin/kill-switch`, { target, enabled }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchStats(token);
        } catch (err) {
            alert("Switch failed.");
        }
    };

    const moderateUser = async (userId, action) => {
        if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;
        try {
            await axios.post(`${API_URL}/admin/user/moderate`, { userId, action }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchUsers(token);
        } catch (err) {
            alert("Moderation failed.");
        }
    };

    if (loading) return (
        <div style={styles.loader}>
            <Activity size={48} className="animate-pulse" color="#6366f1" />
            <p>Connecting to NIRA's Neural Core...</p>
        </div>
    );

    return (
        <div style={styles.container}>
            {/* Sidebar */}
            <nav style={styles.sidebar}>
                <div style={styles.logo}>
                    <ShieldAlert size={32} color="#818cf8" />
                    <h2>NIRA BRAIN CENTER</h2>
                    <p>MISSION CONTROL (ARSALAN)</p>
                </div>

                <div style={styles.navItems}>
                    <button
                        onClick={() => setActiveTab('stats')}
                        style={{ ...styles.navBtn, ...(activeTab === 'stats' && styles.navBtnActive) }}
                    >
                        <LayoutDashboard size={20} /> Stats
                    </button>
                    <button
                        onClick={() => setActiveTab('brain')}
                        style={{ ...styles.navBtn, ...(activeTab === 'brain' && styles.navBtnActive) }}
                    >
                        <Cpu size={20} /> Brain Control
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        style={{ ...styles.navBtn, ...(activeTab === 'users' && styles.navBtnActive) }}
                    >
                        <Users size={20} /> User Control
                    </button>
                </div>

                <div style={styles.sidebarFooter}>
                    <button onClick={onExit} style={styles.exitBtn}>
                        <Power size={18} /> Exit Dashboard
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main style={styles.content}>
                <header style={styles.header}>
                    <h1>{activeTab.toUpperCase()} OVERVIEW</h1>
                    <div style={styles.health}>
                        <Zap size={16} /> SYSTEM ONLINE
                    </div>
                </header>

                <AnimatePresence mode="wait">
                    {activeTab === 'stats' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} key="stats">
                            <div style={styles.statGrid}>
                                <StatCard icon={<Users />} label="Total Users" val={stats.activeUsers} color="#818cf8" />
                                <StatCard icon={<Zap />} label="Today's Messages" val={stats.usage.counts?.chat || 0} color="#fbbf24" />
                                <StatCard icon={<Cpu />} label="Groq Calls" val={stats.usage.counts?.groq || 0} color="#10b981" />
                                <StatCard icon={<Activity />} label="Gemini Calls" val={stats.usage.counts?.gemini || 0} color="#3b82f6" />
                            </div>

                            <section style={styles.section}>
                                <h3><AlertTriangle size={18} /> EMERGENCY KILL SWITCHES</h3>
                                <div style={styles.toggleRow}>
                                    <KillSwitch
                                        label="Global Kill Switch"
                                        active={config.emergency?.killSwitch}
                                        onToggle={() => toggleKillSwitch('emergency.killSwitch', !config.emergency?.killSwitch)}
                                        urgent
                                    />
                                    <KillSwitch
                                        label="Disable Vision"
                                        active={!config.features?.visionEnabled}
                                        onToggle={() => toggleKillSwitch('features.visionEnabled', !config.features?.visionEnabled)}
                                    />
                                    <KillSwitch
                                        label="Disable Search"
                                        active={!config.features?.searchEnabled}
                                        onToggle={() => toggleKillSwitch('features.searchEnabled', !config.features?.searchEnabled)}
                                    />
                                </div>
                            </section>
                        </motion.div>
                    )}

                    {activeTab === 'brain' && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} key="brain">
                            <div style={styles.configCard}>
                                <h3>Brain Orchestration</h3>
                                <div style={styles.formGroup}>
                                    <label>Primary Model</label>
                                    <select
                                        value={config.ai.primaryModel}
                                        onChange={(e) => setConfig({ ...config, ai: { ...config.ai, primaryModel: e.target.value } })}
                                        style={styles.select}
                                    >
                                        <option value="groq">Groq (Llama 3.3)</option>
                                        <option value="gemini">Gemini Flash</option>
                                    </select>
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Temperature (Creativity): {config.ai.temperature}</label>
                                    <input
                                        type="range" min="0.1" max="1" step="0.05"
                                        value={config.ai.temperature}
                                        onChange={(e) => setConfig({ ...config, ai: { ...config.ai, temperature: parseFloat(e.target.value) } })}
                                        style={styles.range}
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Global User Limit (Msgs/Day)</label>
                                    <input
                                        type="number"
                                        value={config.maxMessagesPerUser}
                                        onChange={(e) => setConfig({ ...config, maxMessagesPerUser: parseInt(e.target.value) })}
                                        style={styles.input}
                                    />
                                </div>
                                <button onClick={() => handleConfigSave(config)} style={styles.saveBtn}>
                                    <Save size={18} /> Save AI Configuration
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'users' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="users">
                            <div style={styles.tableCard}>
                                <table style={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>User Info</th>
                                            <th>Created At</th>
                                            <th>Interactions</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(u => (
                                            <tr key={u.id}>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{ fontWeight: 600 }}>{u.name || "Anonymous"}</span>
                                                        <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{u.id}</span>
                                                    </div>
                                                </td>
                                                <td>{new Date(u.createdAt?._seconds * 1000).toLocaleDateString()}</td>
                                                <td>{u.totalInteractions || 0}</td>
                                                <td>
                                                    <span style={{
                                                        ...styles.badge,
                                                        background: u.isSuspended ? '#ef444422' : '#10b98122',
                                                        color: u.isSuspended ? '#ef4444' : '#10b981'
                                                    }}>
                                                        {u.isSuspended ? 'Suspended' : 'Active'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={() => moderateUser(u.id, u.isSuspended ? 'activate' : 'suspend')}
                                                        style={styles.actionBtn}
                                                    >
                                                        {u.isSuspended ? <RefreshCcw size={16} /> : <Lock size={16} />}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

const StatCard = ({ icon, label, val, color }) => (
    <div style={styles.statCard}>
        <div style={{ ...styles.statIcon, background: `${color}22`, color }}>
            {icon}
        </div>
        <div style={styles.statInfo}>
            <p>{label}</p>
            <h3>{val}</h3>
        </div>
    </div>
);

const KillSwitch = ({ label, active, onToggle, urgent }) => (
    <div style={styles.killSwitch}>
        <span>{label}</span>
        <button
            onClick={onToggle}
            style={{
                ...styles.switchBtn,
                backgroundColor: active ? (urgent ? '#ef4444' : '#f59e0b') : '#3f3f46'
            }}
        >
            <div style={{ ...styles.switchKnob, transform: active ? 'translateX(24px)' : 'translateX(0)' }} />
        </button>
    </div>
);

const styles = {
    container: {
        display: 'flex',
        height: '100vh',
        background: '#0a0a0c',
        color: '#f4f4f5',
        fontFamily: "'Inter', system-ui, sans-serif",
    },
    sidebar: {
        width: '280px',
        background: 'rgba(18, 18, 22, 0.8)',
        backdropFilter: 'blur(10px)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
    },
    logo: {
        marginBottom: '40px',
        textAlign: 'center',
        h2: { margin: '10px 0 0', fontSize: '1.2rem', letterSpacing: '2px' },
        p: { fontSize: '0.6rem', color: '#818cf8', fontWeight: 800 }
    },
    navItems: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    navBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        border: 'none',
        background: 'transparent',
        color: '#a1a1aa',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        textAlign: 'left',
        fontSize: '0.95rem'
    },
    navBtnActive: {
        background: 'rgba(99, 102, 241, 0.1)',
        color: '#818cf8',
    },
    content: {
        flex: 1,
        padding: '40px',
        overflowY: 'auto'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
        h1: { fontSize: '1.5rem', fontWeight: 800, color: '#fff' }
    },
    health: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.75rem',
        color: '#10b981',
        background: 'rgba(16, 185, 129, 0.1)',
        padding: '6px 12px',
        borderRadius: '20px',
        fontWeight: 600
    },
    statGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
    },
    statCard: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '20px',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
    },
    statIcon: {
        width: '48px',
        height: '48px',
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    statInfo: {
        p: { fontSize: '0.8rem', opacity: 0.6, margin: 0 },
        h3: { fontSize: '1.5rem', margin: 0, fontWeight: 700 }
    },
    section: {
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '24px',
        padding: '32px',
        h3: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', marginBottom: '24px', color: '#ef4444' }
    },
    toggleRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '24px'
    },
    killSwitch: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        background: 'rgba(255,255,255,0.03)',
        padding: '16px 24px',
        borderRadius: '16px',
        span: { fontSize: '0.9rem', fontWeight: 500 }
    },
    switchBtn: {
        width: '52px',
        height: '28px',
        borderRadius: '20px',
        border: 'none',
        padding: '2px',
        cursor: 'pointer',
        transition: 'all 0.3s'
    },
    switchKnob: {
        width: '24px',
        height: '24px',
        background: '#fff',
        borderRadius: '50%',
        transition: 'all 0.3s'
    },
    configCard: {
        maxWidth: '500px',
        background: 'rgba(255,255,255,0.03)',
        padding: '32px',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.05)',
    },
    formGroup: {
        marginBottom: '20px',
        label: { display: 'block', marginBottom: '8px', fontSize: '0.85rem', opacity: 0.7 }
    },
    select: {
        width: '100%',
        padding: '12px',
        background: '#18181b',
        border: '1px solid #3f3f46',
        borderRadius: '12px',
        color: '#fff',
        outline: 'none'
    },
    range: { width: '100%', cursor: 'pointer' },
    input: {
        width: '100%',
        padding: '12px',
        background: '#18181b',
        border: '1px solid #3f3f46',
        borderRadius: '12px',
        color: '#fff',
        outline: 'none'
    },
    saveBtn: {
        width: '100%',
        padding: '14px',
        background: '#6366f1',
        border: 'none',
        borderRadius: '12px',
        color: '#fff',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        marginTop: '20px',
        cursor: 'pointer'
    },
    tableCard: {
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '24px',
        padding: '20px',
        overflow: 'hidden'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        th: { textAlign: 'left', padding: '16px', fontSize: '0.8rem', opacity: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' },
        td: { padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }
    },
    badge: {
        padding: '4px 10px',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 600
    },
    actionBtn: {
        background: 'rgba(255,255,255,0.05)',
        border: 'none',
        color: '#fff',
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        cursor: 'pointer'
    },
    sidebarFooter: {
        marginTop: 'auto',
        paddingTop: '20px',
        borderTop: '1px solid rgba(255,255,255,0.05)'
    },
    exitBtn: {
        width: '100%',
        padding: '12px',
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#ef4444',
        border: 'none',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        cursor: 'pointer',
        fontSize: '0.9rem'
    },
    loader: {
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0c',
        gap: '20px'
    }
};

export default AdminDashboard;
