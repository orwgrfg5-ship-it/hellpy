import React, { useState } from 'react';
import { api } from '../api';

export default function Login({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ identifier: '', username: '', email: '', password: '', totp: '' });
  const [error, setError] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login'
        ? { identifier: form.identifier, password: form.password, ...(needsTotp ? { totp: form.totp } : {}) }
        : { username: form.username, email: form.email, password: form.password };
      const data = await api(path, { method: 'POST', body: JSON.stringify(body) });
      localStorage.setItem('token', data.token);
      onAuth(data.user);
    } catch (err) {
      // Backend signals a required 2FA code via a 401 with this message.
      if (/2fa/i.test(err.message)) {
        setNeedsTotp(true);
        setError(needsTotp ? 'Invalid 2FA code, try again.' : 'Enter your 2FA code.');
      } else {
        setError(err.message);
      }
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-gray-100">
      <form onSubmit={submit} className="w-80 space-y-3 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-bold">Helppy {mode === 'login' ? 'Login' : 'Register'}</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {mode === 'login' ? (
          <input className="w-full rounded border p-2" placeholder="Username or email"
            value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} />
        ) : (
          <>
            <input className="w-full rounded border p-2" placeholder="Username"
              value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <input className="w-full rounded border p-2" placeholder="Email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </>
        )}
        <input type="password" className="w-full rounded border p-2" placeholder="Password"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {mode === 'login' && needsTotp && (
          <input className="w-full rounded border p-2" placeholder="2FA code" inputMode="numeric"
            value={form.totp} onChange={(e) => setForm({ ...form, totp: e.target.value })} />
        )}
        <button className="w-full rounded bg-indigo-600 p-2 text-white">{mode === 'login' ? 'Log in' : 'Sign up'}</button>
        <button type="button" className="w-full text-sm text-indigo-600"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Need an account? Register' : 'Have an account? Log in'}
        </button>
      </form>
    </div>
  );
}
