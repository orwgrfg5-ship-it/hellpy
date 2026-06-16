import React, { useEffect, useState } from 'react';
import { api } from './api';
import { resetSocket } from './socket';
import Login from './components/Login.jsx';
import Chat from './components/Chat.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('token')) { setLoading(false); return; }
    api('/api/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <Login onAuth={setUser} />;
  return <Chat user={user} onLogout={async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    resetSocket();
    localStorage.removeItem('token');
    setUser(null);
  }} />;
}
