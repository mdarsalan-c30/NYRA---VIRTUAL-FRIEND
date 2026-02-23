import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Auth from './components/Auth';
import Chat from './components/Chat';
import AdminDashboard from './components/AdminDashboard';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // ALWAYS ADMIN if User is MD ARSALAN (Founder UID or Name)
        const FOUNDER_UID = "yWTvAdxivCba14iMB5yiNoayJ8V2";
        const isFounder = currentUser.uid === FOUNDER_UID ||
          currentUser.email?.includes('arsalan') ||
          currentUser.displayName?.toLowerCase().includes('arsalan');

        if (isFounder) setIsAdmin(true);

        // Check for Admin Role in Firestore
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const role = data.role || '';
            const name = data.name?.toLowerCase() || '';
            if (role === 'super_admin' || name.includes('arsalan') || isFounder) {
              setIsAdmin(true);
            }
          }
        } catch (err) {
          if (isFounder) setIsAdmin(true); // Fallback
          console.warn("Role check failed");
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Direct URL Routing for Admin
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/admin') {
      setShowAdmin(true);
    }
  }, []);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0a0a0c', color: 'white' }}>
        <p>Waking up NIRA...</p>
      </div>
    );
  }

  // Admin View (URL or State)
  if (user && isAdmin && showAdmin) {
    return <AdminDashboard user={user} onExit={() => setShowAdmin(false)} />;
  }

  return (
    <div className="App">
      {user ? (
        <Chat
          isAdmin={isAdmin}
          onOpenAdmin={() => {
            window.history.pushState({}, '', '/admin');
            setShowAdmin(true);
          }}
        />
      ) : (
        <Auth onAuthSuccess={() => { }} />
      )}
    </div>
  );
}

export default App;
