import React, { useEffect, useState } from 'react';
import { api } from '../api';

// Popover listing bookmarked/saved messages for the user.
export default function Bookmarks({ onClose }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    api('/api/bookmarks').then((d) => setMessages(d.messages || [])).catch(() => setMessages([]));
  }, []);

  const removeBookmark = async (messageId) => {
    try {
      await api(`/api/bookmarks/${messageId}`, { method: 'DELETE' });
      setMessages(messages.filter(m => m.id !== messageId));
    } catch (err) {
      console.error('Failed to remove bookmark:', err);
    }
  };

  return (
    <div className="absolute right-2 top-12 z-20 w-80 rounded-lg bg-[var(--bg-1)] p-3 text-[var(--text)] shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">🔖 Bookmarked Messages</span>
        <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--text)]">✕</button>
      </div>
      <div className="max-h-80 space-y-2 overflow-y-auto scroll-thin">
        {messages.length ? messages.map((m) => (
          <div key={m.id} className="rounded bg-[var(--bg-2)] p-2 flex justify-between items-start">
            <div className="flex-1">
              <p className="text-sm font-semibold">{m.author?.displayName || m.author?.username}</p>
              <p className="text-sm text-[var(--muted)]">{m.content}</p>
            </div>
            <button
              onClick={() => removeBookmark(m.id)}
              className="ml-2 text-xs text-[var(--muted)] hover:text-[var(--text)]"
              title="Remove bookmark"
            >
              ✕
            </button>
          </div>
        )) : <p className="text-sm text-[var(--muted)]">No bookmarked messages.</p>}
      </div>
    </div>
  );
}
