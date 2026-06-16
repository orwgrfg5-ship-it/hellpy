import React, { useEffect, useState } from 'react';
import { api } from '../api';

// Popover listing pinned messages for the current channel/conversation.
export default function Pins({ target, onClose }) {
  const [messages, setMessages] = useState([]);
  const path = target.kind === 'channel'
    ? `/api/messages/channel/${target.id}/pins`
    : `/api/conversations/${target.id}/pins`;

  useEffect(() => { api(path).then((d) => setMessages(d.messages)); }, [target.id]);

  return (
    <div className="absolute right-2 top-12 z-20 w-80 rounded-lg bg-[var(--bg-1)] p-3 text-[var(--text)] shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">📌 Pinned Messages</span>
        <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--text)]">✕</button>
      </div>
      <div className="max-h-80 space-y-2 overflow-y-auto scroll-thin">
        {messages.length ? messages.map((m) => (
          <div key={m.id} className="rounded bg-[var(--bg-2)] p-2">
            <p className="text-sm font-semibold">{m.author?.displayName || m.author?.username}</p>
            <p className="text-sm text-[var(--muted)]">{m.content}</p>
          </div>
        )) : <p className="text-sm text-[var(--muted)]">No pinned messages.</p>}
      </div>
    </div>
  );
}
