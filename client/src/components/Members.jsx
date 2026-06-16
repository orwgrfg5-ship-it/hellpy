import React, { useEffect, useState } from 'react';
import { api } from '../api';
import PresenceDot from './PresenceDot.jsx';

const RANK = { OWNER: 4, ADMIN: 3, MODERATOR: 2, MEMBER: 1 };
const ROLE_COLOR = { OWNER: 'text-yellow-400', ADMIN: 'text-red-400', MODERATOR: 'text-blue-400', MEMBER: 'text-[var(--muted)]' };

// Right-hand member list for a server, with owner/admin/mod controls.
export default function Members({ serverId }) {
  const [members, setMembers] = useState([]);
  const [myRole, setMyRole] = useState('MEMBER');
  const [menuFor, setMenuFor] = useState(null);

  async function load() {
    const d = await api(`/api/servers/${serverId}/members`);
    setMembers(d.members);
    setMyRole(d.me.role);
  }
  useEffect(() => { load(); }, [serverId]);

  const canModerate = (targetRole) => RANK[myRole] >= RANK.MODERATOR && RANK[myRole] > RANK[targetRole];
  const isAdmin = RANK[myRole] >= RANK.ADMIN;

  async function mod(action, userId, extra = {}) {
    await api(`/api/moderation/${serverId}/${action}`, { method: 'POST', body: JSON.stringify({ targetId: userId, ...extra }) });
    setMenuFor(null); load();
  }
  async function setRole(userId, role) {
    await api(`/api/servers/${serverId}/members/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
    setMenuFor(null); load();
  }

  const groups = ['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'];

  return (
    <div className="w-60 overflow-y-auto scroll-thin bg-[var(--bg-1)] p-3 text-[var(--text)]">
      <p className="px-1 pb-2 text-xs uppercase text-[var(--muted)]">Members — {members.length}</p>
      {groups.map((g) => {
        const inGroup = members.filter((m) => m.role === g);
        if (!inGroup.length) return null;
        return (
          <div key={g} className="mb-2">
            <p className={`px-1 text-xs uppercase ${ROLE_COLOR[g]}`}>{g}</p>
            {inGroup.map((m) => (
              <div key={m.id} className="relative">
                <button onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-[var(--bg-3)]">
                  <PresenceDot status={m.user.presence} />
                  <span className="truncate">{m.user.displayName || m.user.username}</span>
                  {(m.timeoutUntil || m.mutedUntil) && <span title="restricted" className="ml-auto text-xs">🔇</span>}
                </button>
                {menuFor === m.id && (canModerate(m.role) || isAdmin) && (
                  <div className="absolute right-0 z-10 mt-1 w-40 rounded bg-[var(--bg-0)] p-1 text-sm shadow-lg">
                    {canModerate(m.role) && <>
                      <button onClick={() => mod('kick', m.user.id)} className="block w-full rounded px-2 py-1 text-left hover:bg-[var(--bg-3)]">Kick</button>
                      <button onClick={() => mod('ban', m.user.id)} className="block w-full rounded px-2 py-1 text-left text-red-400 hover:bg-[var(--bg-3)]">Ban</button>
                      <button onClick={() => mod('timeout', m.user.id, { minutes: 10 })} className="block w-full rounded px-2 py-1 text-left hover:bg-[var(--bg-3)]">Timeout 10m</button>
                      <button onClick={() => mod('mute', m.user.id, { minutes: 10 })} className="block w-full rounded px-2 py-1 text-left hover:bg-[var(--bg-3)]">Mute 10m</button>
                    </>}
                    {isAdmin && m.role !== 'OWNER' && canModerate(m.role) && (
                      <div className="mt-1 border-t border-white/10 pt-1">
                        <p className="px-2 text-xs text-[var(--muted)]">Set role</p>
                        {['ADMIN', 'MODERATOR', 'MEMBER'].map((r) => (
                          <button key={r} onClick={() => setRole(m.user.id, r)} className="block w-full rounded px-2 py-1 text-left hover:bg-[var(--bg-3)]">{r}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
