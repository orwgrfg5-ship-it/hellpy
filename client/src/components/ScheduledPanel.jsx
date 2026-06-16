import React, { useEffect, useState } from 'react';
import { api } from '../api';

// Lists the user's pending scheduled messages with the option to cancel them.
export default function ScheduledPanel({ onClose }) {
  const [items, setItems] = useState([]);

  async function load() { setItems(await api('/api/scheduled').then((d) => d.scheduled).catch(() => [])); }
  useEffect(() => { load(); }, []);

  async function cancel(id) { await api(`/api/scheduled/${id}`, { method: 'DELETE' }); load(); }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-[460px] rounded-xl bg-[var(--bg-2)] p-5 text-[var(--text)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">Scheduled messages</h3>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--text)]">✕</button>
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto scroll-thin">
          {items.length ? items.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded bg-[var(--bg-1)] p-2">
              <div className="min-w-0">
                <p className="truncate text-sm">{s.content}</p>
                <p className="text-xs text-[var(--muted)]">{new Date(s.sendAt).toLocaleString()}</p>
              </div>
              <button onClick={() => cancel(s.id)} className="ml-2 rounded bg-[var(--bg-0)] px-3 py-1 text-sm text-red-400">Cancel</button>
            </div>
          )) : <p className="text-sm text-[var(--muted)]">No pending scheduled messages.</p>}
        </div>
      </div>
    </div>
  );
}
