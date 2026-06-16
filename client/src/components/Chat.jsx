import React, { useEffect, useState } from 'react';
import { api } from '../api';
import Friends from './Friends.jsx';
import MessageView from './MessageView.jsx';
import PresenceDot from './PresenceDot.jsx';
import CallPanel from './CallPanel.jsx';
import GroupCallPanel from './GroupCallPanel.jsx';
import Members from './Members.jsx';
import NewDM from './NewDM.jsx';
import Settings from './Settings.jsx';
import AuditLog from './AuditLog.jsx';
import Bookmarks from './Bookmarks.jsx';
import { useCall } from '../useCall';
import { useGroupCall } from '../useGroupCall';

// Top-level app shell: server rail, contextual sidebar (DMs or channels), and main pane.
export default function Chat({ user, onLogout }) {
  const [servers, setServers] = useState([]);
  const [conversations, setConversations] = useState([]);
  // view: { mode: 'home' } | { mode: 'friends' } | { mode: 'server', server } 
  const [view, setView] = useState({ mode: 'friends' });
  const [target, setTarget] = useState(null); // active channel/conversation MessageView target
  const [invisible, setInvisible] = useState(user.invisible || false);
  const [profile, setProfile] = useState(user);
  const [showSettings, setShowSettings] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showMembers, setShowMembers] = useState(true);
  const [unread, setUnread] = useState({}); // channelId -> count
  const [showAudit, setShowAudit] = useState(false);
  const [categories, setCategories] = useState([]); // categories for the active server
  const [collapsed, setCollapsed] = useState({}); // categoryId -> bool
  const [showBookmarks, setShowBookmarks] = useState(false);

  // Move a channel into a category (or out, with index 0).
  async function moveChannel(channelId) {
    const choices = categories.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
    const pick = prompt(`Move to which category?\n0. (none)\n${choices}`);
    if (pick === null) return;
    const idx = parseInt(pick, 10);
    const categoryId = idx > 0 ? categories[idx - 1]?.id : null;
    await api(`/api/servers/${view.server.id}/channels/${channelId}/category`, { method: 'PATCH', body: JSON.stringify({ categoryId }) });
    const refreshed = await api('/api/servers');
    setServers(refreshed.servers);
    const updated = refreshed.servers.find((s) => s.id === view.server.id);
    if (updated) setView({ mode: 'server', server: updated });
    const cats = await api(`/api/servers/${view.server.id}/categories`);
    setCategories(cats.categories);
  }

  // Load categories whenever the active server changes.
  useEffect(() => {
    if (view.mode === 'server') {
      api(`/api/servers/${view.server.id}/categories`).then((d) => setCategories(d.categories)).catch(() => setCategories([]));
    }
  }, [view.mode, view.mode === 'server' ? view.server.id : null]);
  const call = useCall(user.id);
  const groupCall = useGroupCall(user.id);

  async function createCategory() {
    if (view.mode !== 'server') return;
    const name = prompt('Category name?');
    if (!name) return;
    await api(`/api/servers/${view.server.id}/categories`, { method: 'POST', body: JSON.stringify({ name }) });
    const d = await api(`/api/servers/${view.server.id}/categories`);
    setCategories(d.categories);
  }

  // Renders a single channel row (shared by categorized + uncategorized lists).
  function ChannelRow(c) {
    return (
      <div key={c.id} className="group flex items-center">
        <button onClick={() => { setTarget({ kind: 'channel', id: c.id, name: c.name }); markChannelRead(c.id); }}
          className={`flex flex-1 items-center justify-between rounded px-2 py-1 text-left hover:bg-[var(--bg-3)] ${target?.kind === 'channel' && target.id === c.id ? 'bg-[var(--bg-3)] text-white' : (unread[c.id] > 0 ? 'font-semibold text-white' : 'text-[var(--muted)]')}`}>
          <span># {c.name}</span>
          {unread[c.id] > 0 && target?.id !== c.id && (
            <span className="ml-2 rounded-full bg-red-500 px-2 text-xs text-white">{unread[c.id] > 99 ? '99+' : unread[c.id]}</span>
          )}
        </button>
        <button onClick={() => moveChannel(c.id)} title="Move to category"
          className="hidden px-1 text-xs text-[var(--muted)] group-hover:block">🗂️</button>
        <button onClick={() => deleteChannel(c.id)} title="Delete channel"
          className="hidden px-1 text-xs text-red-400 group-hover:block">✕</button>
      </div>
    );
  }

  // Clear a channel's badge once read.
  function markChannelRead(channelId) {
    setUnread((u) => ({ ...u, [channelId]: 0 }));
  }

  async function createChannel() {
    if (view.mode !== 'server') return;
    const name = prompt('Channel name?');
    if (!name) return;
    const d = await api(`/api/servers/${view.server.id}/channels`, { method: 'POST', body: JSON.stringify({ name }) });
    const refreshed = await api('/api/servers');
    setServers(refreshed.servers);
    const updated = refreshed.servers.find((s) => s.id === view.server.id);
    if (updated) setView({ mode: 'server', server: updated });
  }
  async function deleteChannel(channelId) {
    if (view.mode !== 'server' || !confirm('Delete this channel?')) return;
    await api(`/api/servers/${view.server.id}/channels/${channelId}`, { method: 'DELETE' });
    const refreshed = await api('/api/servers');
    setServers(refreshed.servers);
    const updated = refreshed.servers.find((s) => s.id === view.server.id);
    if (updated) { setView({ mode: 'server', server: updated }); if (target?.id === channelId) setTarget(null); }
  }
  async function createInvite() {
    if (view.mode !== 'server') return;
    const d = await api(`/api/servers/${view.server.id}/invites`, { method: 'POST' });
    prompt('Share this invite code:', d.invite.code);
  }
  async function joinServer() {
    const code = prompt('Enter invite code:');
    if (!code) return;
    await api(`/api/servers/join/${code}`, { method: 'POST' });
    loadServers();
  }

  async function loadServers() { const d = await api('/api/servers'); setServers(d.servers); }
  async function loadConversations() { const d = await api('/api/conversations'); setConversations(d.conversations); }
  async function loadUnread() { const d = await api('/api/messages/unread').catch(() => ({ unread: {} })); setUnread(d.unread || {}); }
  useEffect(() => { loadServers(); loadConversations(); loadUnread(); }, []);

  // Poll unread counts periodically so badges stay fresh.
  useEffect(() => {
    const t = setInterval(loadUnread, 15000);
    return () => clearInterval(t);
  }, []);

  async function createServer() {
    const name = prompt('Server name?');
    if (!name) return;
    await api('/api/servers', { method: 'POST', body: JSON.stringify({ name }) });
    loadServers();
  }

  function openDM(conversation) {
    loadConversations();
    setView({ mode: 'home' });
    const other = conversation.members?.find((m) => m.user?.id !== user.id)?.user;
    setTarget({ kind: 'conversation', id: conversation.id, peerUserId: other?.id || null, name: other?.username || conversation.name || 'Direct Message' });
  }

  // Start (or open) a DM with a specific user id, e.g. from a profile card.
  async function messageUser(userId) {
    const d = await api('/api/conversations', { method: 'POST', body: JSON.stringify({ userIds: [userId] }) });
    openDM(d.conversation);
  }

  async function toggleInvisible() {
    const next = !invisible;
    setInvisible(next);
    await api('/api/users/me/presence', { method: 'PATCH', body: JSON.stringify({ invisible: next, presence: next ? 'OFFLINE' : 'ONLINE' }) });
  }

  const convName = (c) => {
    const other = c.members?.find((m) => m.user?.id !== user.id)?.user;
    return c.type === 'GROUP' ? (c.name || 'Group chat') : (other?.displayName || other?.username || 'DM');
  };

  return (
    <div className="flex h-full text-[var(--text)]">
      {/* Server rail */}
      <div className="flex w-[72px] flex-col items-center gap-2 bg-[var(--bg-0)] py-3">
        <button onClick={() => setView({ mode: 'friends' })}
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] font-bold ${view.mode !== 'server' ? 'ring-2 ring-white' : ''}`}>H</button>
        <div className="h-px w-8 bg-white/10" />
        {servers.map((s) => (
          <button key={s.id} title={s.name}
            onClick={() => { setView({ mode: 'server', server: s }); const c = s.channels?.[0]; if (c) setTarget({ kind: 'channel', id: c.id, name: c.name }); }}
            className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-1)] font-semibold hover:rounded-xl ${view.mode === 'server' && view.server.id === s.id ? 'rounded-xl ring-2 ring-white' : ''}`}>
            {s.name.slice(0, 2).toUpperCase()}
          </button>
        ))}
        <button onClick={createServer} title="Create server" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-1)] text-2xl text-green-400 hover:rounded-xl">+</button>
        <button onClick={joinServer} title="Join server" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-1)] text-xl text-green-400 hover:rounded-xl">↳</button>
      </div>

      {/* Contextual sidebar */}
      <div className="flex w-60 flex-col bg-[var(--bg-1)]">
        <div className="flex-1 overflow-y-auto scroll-thin p-2">
          {view.mode === 'server' ? (
            <>
              <div className="flex items-center justify-between px-2 py-2">
                <p className="font-bold">{view.server.name}</p>
                <div className="flex gap-1 text-sm">
                  <button onClick={createInvite} title="Invite" className="rounded px-1 hover:bg-[var(--bg-3)]">📨</button>
                  <button onClick={createChannel} title="Add channel" className="rounded px-1 hover:bg-[var(--bg-3)]">+</button>
                  <button onClick={createCategory} title="Add category" className="rounded px-1 hover:bg-[var(--bg-3)]">🗂️</button>
                  <button onClick={() => setShowAudit(true)} title="Audit log" className="rounded px-1 hover:bg-[var(--bg-3)]">📜</button>
                  <button onClick={() => setShowMembers((v) => !v)} title="Toggle members" className="rounded px-1 hover:bg-[var(--bg-3)]">👥</button>
                </div>
              </div>
              {/* Uncategorized channels first */}
              {view.server.channels?.filter((c) => !c.categoryId).map(ChannelRow)}
              {/* Then each category with its channels (collapsible) */}
              {categories.map((cat) => (
                <div key={cat.id} className="mt-2">
                  <button onClick={() => setCollapsed((s) => ({ ...s, [cat.id]: !s[cat.id] }))}
                    className="flex w-full items-center gap-1 px-1 text-xs font-semibold uppercase text-[var(--muted)] hover:text-[var(--text)]">
                    <span>{collapsed[cat.id] ? '▶' : '▼'}</span> {cat.name}
                  </button>
                  {!collapsed[cat.id] && (cat.channels || []).map(ChannelRow)}
                </div>
              ))}
            </>
          ) : (
            <>
              <button onClick={() => { setView({ mode: 'friends' }); setTarget(null); }}
                className={`mb-2 block w-full rounded px-2 py-2 text-left font-medium hover:bg-[var(--bg-3)] ${view.mode === 'friends' ? 'bg-[var(--bg-3)]' : ''}`}>
                👥 Friends
              </button>
              <div className="flex items-center justify-between px-2 py-1">
                <p className="text-xs uppercase text-[var(--muted)]">Direct Messages</p>
                <button onClick={() => setShowNewDM(true)} title="New DM" className="rounded px-1 text-sm hover:bg-[var(--bg-3)]">+</button>
              </div>
              {conversations.map((c) => {
                const other = c.members?.find((m) => m.user?.id !== user.id)?.user;
                return (
                <button key={c.id} onClick={() => { setView({ mode: 'home' }); setTarget({ kind: 'conversation', id: c.id, peerUserId: other?.id || null, name: convName(c) }); }}
                  className={`block w-full truncate rounded px-2 py-1 text-left text-[var(--muted)] hover:bg-[var(--bg-3)] ${target?.kind === 'conversation' && target.id === c.id ? 'bg-[var(--bg-3)] text-white' : ''}`}>
                  @ {convName(c)}
                </button>
                );
              })}
            </>
          )}
        </div>
        {/* User bar */}
        <div className="flex items-center justify-between bg-[var(--bg-0)] px-2 py-2">
          <div className="flex items-center gap-2">
            <PresenceDot status={invisible ? 'OFFLINE' : 'ONLINE'} />
            <span className="text-sm font-medium">{profile.displayName || profile.username}</span>
          </div>
          <div className="flex gap-1">
            <button onClick={toggleInvisible} title="Toggle invisible" className="rounded px-2 text-xs hover:bg-[var(--bg-3)]">{invisible ? '👻' : '🟢'}</button>
            <button onClick={() => setShowBookmarks(true)} title="Saved messages" className="rounded px-2 text-xs hover:bg-[var(--bg-3)]">🔖</button>
            <button onClick={() => setShowSettings(true)} title="Settings" className="rounded px-2 text-xs hover:bg-[var(--bg-3)]">⚙️</button>
            <button onClick={onLogout} title="Log out" className="rounded px-2 text-xs hover:bg-[var(--bg-3)]">⏻</button>
          </div>
        </div>
      </div>

      {/* Main pane */}
      <div className="relative flex flex-1">
        <CallPanel call={call} />
        <GroupCallPanel group={groupCall} />
        {view.mode === 'friends' || !target
          ? <Friends onOpenDM={openDM} />
          : <MessageView
              key={`${target.kind}:${target.id}`}
              target={target}
              currentUserId={user.id}
              onMessageUser={messageUser}
              onChannelRead={markChannelRead}
              headerActions={target.kind === 'conversation' ? (
                target.peerUserId ? (
                  <>
                    <button onClick={() => call.startCall(target.peerUserId, 'audio')} title="Voice call"
                      className="rounded px-2 py-1 text-sm hover:bg-[var(--bg-3)]">📞</button>
                    <button onClick={() => call.startCall(target.peerUserId, 'video')} title="Video call"
                      className="rounded px-2 py-1 text-sm hover:bg-[var(--bg-3)]">📹</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => groupCall.join(target.id, 'audio')} title="Group voice call"
                      className="rounded px-2 py-1 text-sm hover:bg-[var(--bg-3)]">📞</button>
                    <button onClick={() => groupCall.join(target.id, 'video')} title="Group video call"
                      className="rounded px-2 py-1 text-sm hover:bg-[var(--bg-3)]">📹</button>
                  </>
                )
              ) : null}
            />}
        {/* Server member list */}
        {view.mode === 'server' && showMembers && target?.kind === 'channel' && <Members serverId={view.server.id} />}
      </div>

      {showSettings && <Settings user={profile} onClose={() => setShowSettings(false)} onUpdated={setProfile} />}
      {showNewDM && <NewDM onClose={() => setShowNewDM(false)} onCreated={openDM} />}
      {showAudit && view.mode === 'server' && <AuditLog serverId={view.server.id} onClose={() => setShowAudit(false)} />}
      {showBookmarks && <Bookmarks onClose={() => setShowBookmarks(false)} />}
    </div>
  );
}
