import React, { useEffect, useState } from 'react';
import { api } from '../api';
import PresenceDot from './PresenceDot.jsx';

// Picker to start a DM (one friend) or a group chat (multiple friends).
export default function NewDM({ onClose, onCreated }) {
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');

  useEffect(() => { api('/api/friends').then((d) => setFriends(d.friends)); }, []);

  function toggle(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  async function create() {
    if (!selected.length) return;
    const body = { userIds: selected };
    if (selected.length > 1 && groupName) body.name = groupName;
    const d = await api('/api/conversations', { method: 'POST', body: JSON.stringify(body) });
    onCreated?.(d.conversation);
    onClose?.();
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
      <div className="w-96 rounded-xl bg-[var(--bg-2)] p-5 text-[var(--text)] shadow-2xl">
        <h3 className="mb-3 text-lg font-bold">New message</h3>
        <div className="max-h-64 overflow-y-auto scroll-thin">
          {friends.length ? friends.map((f) => (
            <label key={f.user.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-[var(--bg-3)]">
              <input type="checkbox" checked={selected.includes(f.user.id)} onChange={() => toggle(f.user.id)} />
              <PresenceDot status={f.user.presence} />
              <span>{f.user.displayName || f.user.username}</span>
            </label>
          )) : <p className="text-sm text-[var(--muted)]">Add friends first to message them.</p>}
        </div>
        {selected.length > 1 && (
          <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name (optional)"
            className="mt-3 w-full rounded bg-[var(--bg-3)] px-3 py-2 outline-none" />
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-4 py-2 text-[var(--muted)]">Cancel</button>
          <button onClick={create} disabled={!selected.length} className="rounded bg-[var(--accent)] px-4 py-2 font-medium text-white disabled:opacity-50">
            {selected.length > 1 ? 'Create group' : 'Start DM'}
          </button>
        </div>
      </div>
    </div>
  );
}
