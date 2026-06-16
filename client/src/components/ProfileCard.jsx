import React, { useEffect, useState } from 'react';
import { api } from '../api';
import PresenceDot from './PresenceDot.jsx';

// Popout shown when a username/avatar is clicked. Loads the public profile.
export default function ProfileCard({ username, onClose, onMessage }) {
  const [user, setUser] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api(`/api/users/${encodeURIComponent(username)}`)
      .then((d) => setUser(d.user))
      .catch((e) => setErr(e.message));
  }, [username]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-80 overflow-hidden rounded-xl bg-[var(--bg-1)] text-[var(--text)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {err && <p className="p-4 text-sm text-red-400">{err}</p>}
        {user && (
          <>
            <div className="h-20" style={{ background: user.bannerUrl ? `center/cover url(${user.bannerUrl})` : (user.accentColor || 'var(--accent)') }} />
            <div className="px-4 pb-4">
              <div className="-mt-8 mb-2 flex h-16 w-16 items-center justify-center rounded-full border-4 border-[var(--bg-1)] bg-[var(--bg-3)] text-2xl"
                style={user.avatarUrl ? { background: `center/cover url(${user.avatarUrl})` } : {}}>
                {!user.avatarUrl && (user.displayName || user.username)[0].toUpperCase()}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{user.displayName || user.username}</span>
                <PresenceDot status={user.presence} />
              </div>
              <p className="text-sm text-[var(--muted)]">@{user.username}</p>
              {user.bio && <p className="mt-2 rounded bg-[var(--bg-2)] p-2 text-sm">{user.bio}</p>}
              {onMessage && (
                <button onClick={() => { onMessage(user.id); onClose(); }}
                  className="mt-3 w-full rounded bg-[var(--accent)] py-2 text-sm font-medium text-white">Message</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
