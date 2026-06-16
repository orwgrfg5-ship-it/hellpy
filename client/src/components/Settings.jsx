import React, { useState } from 'react';
import { api } from '../api';
import { getTheme, applyTheme } from '../theme';
import { ensureNotificationPermission } from '../notifications';

// Settings modal: profile (display name, bio, accent, avatar/banner URLs) + appearance (theme).
export default function Settings({ user, onClose, onUpdated }) {
  const [tab, setTab] = useState('profile');
  const [theme, setTheme] = useState(getTheme());
  const [form, setForm] = useState({
    displayName: user.displayName || '',
    bio: user.bio || '',
    accentColor: user.accentColor || '#5865f2',
    avatarUrl: user.avatarUrl || '',
    bannerUrl: user.bannerUrl || '',
  });
  const [saved, setSaved] = useState('');
  // 2FA state
  const [twoFA, setTwoFA] = useState(user.twoFactorEnabled || false);
  const [setupQr, setSetupQr] = useState(null);
  const [setupSecret, setSetupSecret] = useState('');
  const [code, setCode] = useState('');
  const [twoFAMsg, setTwoFAMsg] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);

  async function start2FA() {
    setTwoFAMsg('');
    const d = await api('/api/auth/2fa/setup', { method: 'POST' });
    setSetupQr(d.qr); setSetupSecret(d.secret);
  }
  async function confirm2FA() {
    try {
      const d = await api('/api/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ totp: code }) });
      setTwoFA(true); setSetupQr(null); setCode(''); setTwoFAMsg('Two-factor enabled. Save your recovery codes!');
      setRecoveryCodes(d.recoveryCodes || null);
    } catch (e) { setTwoFAMsg(e.message); }
  }
  async function disable2FA() {
    try {
      await api('/api/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ totp: code }) });
      setTwoFA(false); setCode(''); setTwoFAMsg('Two-factor disabled.');
    } catch (e) { setTwoFAMsg(e.message); }
  }

  async function saveProfile() {
    const d = await api('/api/users/me/profile', { method: 'PATCH', body: JSON.stringify(form) });
    setSaved('Saved.');
    onUpdated?.(d.user);
    setTimeout(() => setSaved(''), 1500);
  }

  function pickTheme(t) { setTheme(t); applyTheme(t); }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
      <div className="flex flex-col h-[520px] w-full md:w-[720px] max-h-[90vh] overflow-hidden rounded-xl bg-[var(--bg-2)] text-[var(--text)] shadow-2xl">
        {/* Tab Navigation - Clickable tabs */}
        <div className="flex gap-0 bg-[var(--bg-1)] border-b border-[var(--bg-3)]">
          {['profile', 'appearance', 'security'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-4 py-3 text-sm font-medium capitalize transition border-b-2 ${
                tab === t
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {t}
            </button>
          ))}
          <button
            onClick={onClose}
            className="px-4 py-3 text-red-400 hover:bg-[var(--bg-3)] transition min-w-max"
            title="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {tab === 'profile' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold">Profile</h3>
              <div
                className="h-16 md:h-24 rounded-lg"
                style={{ background: form.bannerUrl ? `center/cover url(${form.bannerUrl})` : form.accentColor }}
              />
              <label className="block text-xs md:text-sm">Display name
                <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  className="mt-1 w-full rounded bg-[var(--bg-3)] px-3 py-2 text-sm outline-none" placeholder={user.username} />
              </label>
              <label className="block text-xs md:text-sm">Bio
                <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  className="mt-1 w-full rounded bg-[var(--bg-3)] px-3 py-2 text-sm outline-none" rows={3} />
              </label>
              <div className="flex gap-3 flex-col md:flex-row">
                <label className="text-xs md:text-sm">Accent
                  <input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                    className="mt-1 block h-9 w-16 rounded bg-transparent" />
                </label>
                <label className="flex-1 text-xs md:text-sm">Avatar URL
                  <input value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
                    className="mt-1 w-full rounded bg-[var(--bg-3)] px-3 py-2 text-sm outline-none" placeholder="https://..." />
                </label>
              </div>
              <label className="block text-xs md:text-sm">Banner URL
                <input value={form.bannerUrl} onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}
                  className="mt-1 w-full rounded bg-[var(--bg-3)] px-3 py-2 text-sm outline-none" placeholder="https://..." />
              </label>
              <div className="flex items-center gap-3">
                <button onClick={saveProfile} className="rounded bg-[var(--accent)] px-4 py-2 font-medium text-white min-h-10">Save</button>
                {saved && <span className="text-sm text-green-400">{saved}</span>}
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold">Security</h3>
              <div className="rounded-lg bg-[var(--bg-1)] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Two-Factor Authentication (TOTP)</p>
                    <p className="text-sm text-[var(--muted)]">{twoFA ? 'Enabled — a code is required at login.' : 'Add an authenticator app for extra security.'}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs ${twoFA ? 'bg-green-600' : 'bg-[var(--bg-3)]'}`}>{twoFA ? 'ON' : 'OFF'}</span>
                </div>

                {!twoFA && !setupQr && (
                  <button onClick={start2FA} className="mt-3 rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white">Set up 2FA</button>
                )}

                {!twoFA && setupQr && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm">1. Scan this QR code in your authenticator app (or enter the secret manually).</p>
                    <img src={setupQr} alt="2FA QR" className="h-40 w-40 rounded bg-white p-2" />
                    <p className="break-all text-xs text-[var(--muted)]">Secret: {setupSecret}</p>
                    <p className="text-sm">2. Enter the 6-digit code to confirm.</p>
                    <div className="flex gap-2">
                      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456"
                        className="w-32 rounded bg-[var(--bg-3)] px-3 py-2 outline-none" />
                      <button onClick={confirm2FA} className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white">Enable</button>
                    </div>
                  </div>
                )}

                {twoFA && (
                  <div className="mt-3 flex items-center gap-2">
                    <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code to disable"
                      className="w-40 rounded bg-[var(--bg-3)] px-3 py-2 outline-none" />
                    <button onClick={disable2FA} className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white">Disable</button>
                  </div>
                )}
                {twoFAMsg && <p className="mt-2 text-sm text-[var(--muted)]">{twoFAMsg}</p>}
                {recoveryCodes && (
                  <div className="mt-3 rounded bg-[var(--bg-2)] p-3">
                    <p className="mb-2 text-sm font-medium">Recovery codes (each works once — store them safely):</p>
                    <div className="grid grid-cols-2 gap-1 font-mono text-xs">
                      {recoveryCodes.map((c) => <span key={c}>{c}</span>)}
                    </div>
                  </div>
                )}
                <div className="mt-3 border-t border-white/10 pt-3">
                  <button onClick={ensureNotificationPermission} className="rounded bg-[var(--bg-3)] px-3 py-2 text-sm">Enable desktop notifications</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold mb-4">Appearance</h3>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-[var(--text)] mb-3">Theme</p>
                    <div className="flex gap-3">
                      {['dark', 'light'].map((t) => (
                        <button key={t} onClick={() => pickTheme(t)}
                          className={`rounded-lg border px-6 py-3 capitalize transition ${theme === t ? 'border-[var(--accent)] bg-[var(--bg-3)]' : 'border-transparent hover:bg-[var(--bg-3)]'} ${t === 'dark' ? 'bg-[#1e1f22] text-white' : 'bg-white text-black'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="border-t border-[var(--bg-3)] pt-4">
                    <p className="text-sm font-medium text-[var(--text)] mb-2">Mobile Settings</p>
                    <div className="space-y-2 text-sm text-[var(--muted)]">
                      <div className="flex items-start gap-2">
                        <span className="text-base">📱</span>
                        <div>
                          <p className="font-medium text-[var(--text)]">Full-width layout</p>
                          <p className="text-xs">Optimized for mobile and tablet screens</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-base">👆</span>
                        <div>
                          <p className="font-medium text-[var(--text)]">Touch-friendly UI</p>
                          <p className="text-xs">Larger buttons and inputs for easier tapping</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-base">⌚</span>
                        <div>
                          <p className="font-medium text-[var(--text)]">Safe area support</p>
                          <p className="text-xs">Respects notches and rounded corners on all devices</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-[var(--bg-3)] pt-4">
                    <p className="text-xs uppercase text-[var(--muted)] tracking-wider">Browser Info</p>
                    <div className="mt-2 text-xs text-[var(--muted)] space-y-1">
                      <p>Viewport: {window.innerWidth}x{window.innerHeight}px</p>
                      <p>Device: {/iPhone|iPad|Android/.test(navigator.userAgent) ? '📱 Mobile' : '💻 Desktop'}</p>
                      <p>Touch support: {('ontouchstart' in window || navigator.maxTouchPoints > 0) ? '✓ Yes' : '✗ No'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
