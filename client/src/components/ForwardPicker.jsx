import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { getSocket } from '../socket';

// Pick a destination conversation to forward a message into.
export default function ForwardPicker({ message, onClose }) {
  const [conversations, setConversations] = useState([]);

  useEffect(() => { api('/api/conversations').then((d) => setConversations(d.conversations)).catch(() => {}); }, []);

  function name(c, meId) {
    const other = c.members?.find((m) => m.user?.id !== meId)?.user;
    return c.type === 'GROUP' ? (c.name || 'Group chat') : (other?.displayName || other?.username || 'DM');
  }

  function forwardTo(conversationId) {
    getSocket().emit('message:send', {
      room: `conversation:${conversationId}`,
      conversationId,
      content: `↪️ Forwarded:\n${message.content}`,
    });
    onClose();
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-80 rounded-xl bg-[var(--bg-2)] p-5 text-[var(--text)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-lg font-bold">Forward to…</h3>
        <div className="max-h-72 space-y-1 overflow-y-auto scroll-thin">
          {conversations.length ? conversations.map((c) => (
            <button key={c.id} onClick={() => forwardTo(c.id)}
              className="block w-full truncate rounded px-3 py-2 text-left hover:bg-[var(--bg-3)]">@ {name(c)}</button>
          )) : <p className="text-sm text-[var(--muted)]">No conversations yet.</p>}
        </div>
      </div>
    </div>
  );
}
