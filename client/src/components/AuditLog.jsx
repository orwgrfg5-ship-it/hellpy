import React, { useEffect, useState } from 'react';
import { api } from '../api';

const ACTION_LABEL = { KICK: 'kicked', BAN: 'banned', TIMEOUT: 'timed out', MUTE: 'muted' };
const ACTION_COLOR = { KICK: 'text-orange-400', BAN: 'text-red-400', TIMEOUT: 'text-yellow-400', MUTE: 'text-blue-400' };

// Modal listing recent moderation actions for a server.
export default function AuditLog({ serverId, onClose }) {
  const [actions, setActions] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api(`/api/servers/${serverId}/audit-log`).then((d) => setActions(d.actions)).catch((e) => setErr(e.message));
  }, [serverId]);

  const name = (u) => u?.displayName || u?.username || 'unknown';

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="flex h-[480px] w-[560px] flex-col rounded-xl bg-[var(--bg-2)] text-[var(--text)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-black/20 p-4">
          <h3 className="text-lg font-bold">Audit Log</h3>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--text)]">✕</button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto p-3">
          {err && <p className="text-sm text-red-400">{err}</p>}
          {!err && !actions.length && <p className="text-sm text-[var(--muted)]">No moderation actions yet.</p>}
          {actions.map((a) => (
            <div key={a.id} className="border-b border-white/5 py-2 text-sm">
              <span className="font-medium">{name(a.actor)}</span>{' '}
              <span className={ACTION_COLOR[a.type]}>{ACTION_LABEL[a.type] || a.type.toLowerCase()}</span>{' '}
              <span className="font-medium">{name(a.target)}</span>
              {a.reason && <span className="text-[var(--muted)]"> — {a.reason}</span>}
              <div className="text-xs text-[var(--muted)]">{new Date(a.createdAt).toLocaleString()}{a.expiresAt ? ` · until ${new Date(a.expiresAt).toLocaleString()}` : ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
