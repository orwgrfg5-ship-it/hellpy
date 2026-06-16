import React, { useEffect, useState } from 'react';
import { api } from '../api';
import PresenceDot from './PresenceDot.jsx';

// Friends hub: add by username, accept/decline requests, remove friends, start a DM.
export default function Friends({ onOpenDM }) {
  const [data, setData] = useState({ friends: [], incoming: [], outgoing: [] });
  const [username, setUsername] = useState('');
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('all');

  async function load() {
    const d = await api('/api/friends');
    setData(d);
  }
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    setMsg('');
    try {
      await api('/api/friends/request', { method: 'POST', body: JSON.stringify({ username }) });
      setUsername('');
      setMsg('Request sent.');
      load();
    } catch (err) { setMsg(err.message); }
  }
  async function accept(id) { await api(`/api/friends/${id}/accept`, { method: 'POST' }); load(); }
  async function remove(id) { await api(`/api/friends/${id}`, { method: 'DELETE' }); load(); }

  async function startDM(userId) {
    const d = await api('/api/conversations', { method: 'POST', body: JSON.stringify({ userIds: [userId] }) });
    onOpenDM?.(d.conversation);
  }

  const Row = ({ entry, actions }) => (
    <div className="flex items-center justify-between rounded px-3 py-2 hover:bg-[var(--bg-3)]">
      <div className="flex items-center gap-2">
        <PresenceDot status={entry.user.presence} />
        <span className="font-medium">{entry.user.displayName || entry.user.username}</span>
        <span className="text-xs text-[var(--muted)]">@{entry.user.username}</span>
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-[var(--bg-2)] text-[var(--text)]">
      <div className="border-b border-black/20 p-4">
        <h2 className="mb-3 text-lg font-bold">Friends</h2>
        <form onSubmit={add} className="flex gap-2">
          <input value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="Add friend by username"
            className="flex-1 rounded bg-[var(--bg-0)] px-3 py-2 outline-none" />
          <button className="rounded bg-[var(--accent)] px-4 font-medium">Send</button>
        </form>
        {msg && <p className="mt-2 text-sm text-[var(--muted)]">{msg}</p>}
        <div className="mt-3 flex gap-2 text-sm">
          {['all', 'pending'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded px-3 py-1 ${tab === t ? 'bg-[var(--bg-3)]' : ''}`}>
              {t === 'all' ? 'All Friends' : `Pending (${data.incoming.length + data.outgoing.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto p-3">
        {tab === 'all' && (data.friends.length
          ? data.friends.map((e) => (
              <Row key={e.friendshipId} entry={e} actions={
                <>
                  <button onClick={() => startDM(e.user.id)} className="rounded bg-[var(--bg-0)] px-3 py-1 text-sm">Message</button>
                  <button onClick={() => remove(e.friendshipId)} className="rounded bg-[var(--bg-0)] px-3 py-1 text-sm text-red-400">Remove</button>
                </>
              } />
            ))
          : <p className="p-3 text-sm text-[var(--muted)]">No friends yet. Add someone above.</p>)}

        {tab === 'pending' && (
          <>
            <p className="px-3 pt-2 text-xs uppercase text-[var(--muted)]">Incoming</p>
            {data.incoming.length ? data.incoming.map((e) => (
              <Row key={e.friendshipId} entry={e} actions={
                <>
                  <button onClick={() => accept(e.friendshipId)} className="rounded bg-green-600 px-3 py-1 text-sm">Accept</button>
                  <button onClick={() => remove(e.friendshipId)} className="rounded bg-[var(--bg-0)] px-3 py-1 text-sm">Decline</button>
                </>
              } />
            )) : <p className="px-3 text-sm text-[var(--muted)]">None</p>}
            <p className="px-3 pt-3 text-xs uppercase text-[var(--muted)]">Outgoing</p>
            {data.outgoing.length ? data.outgoing.map((e) => (
              <Row key={e.friendshipId} entry={e} actions={
                <button onClick={() => remove(e.friendshipId)} className="rounded bg-[var(--bg-0)] px-3 py-1 text-sm">Cancel</button>
              } />
            )) : <p className="px-3 text-sm text-[var(--muted)]">None</p>}
          </>
        )}
      </div>
    </div>
  );
}
