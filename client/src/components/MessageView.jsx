import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from '../api';
import { getSocket } from '../socket';
import ThreadPanel from './ThreadPanel.jsx';
import ProfileCard from './ProfileCard.jsx';
import Pins from './Pins.jsx';
import Poll from './Poll.jsx';
import CreatePoll from './CreatePoll.jsx';
import ScheduledPanel from './ScheduledPanel.jsx';
import { notifyMessage } from '../notifications';

const POLL_RE = /^\[\[poll:([a-z0-9]+)\]\]$/i;
const AUDIO_RE = /^\[\[audio:(.+)\]\]$/i;

const QUICK_EMOJI = ['👍', '❤️', '😂', '🎉', '😮', '🔥'];

// Reusable real-time message pane for either a channel or a conversation (DM/group).
// `headerActions` lets the parent inject controls (e.g. call buttons in DMs).
export default function MessageView({ target, currentUserId, headerActions, onMessageUser, onChannelRead }) {
  // target = { kind: 'channel'|'conversation', id, name }
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [thread, setThread] = useState(null); // parent message whose thread is open
  const [profileUser, setProfileUser] = useState(null); // username for popout
  const [showPins, setShowPins] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showScheduledPanel, setShowScheduledPanel] = useState(false);
  const draftKey = `helppy-draft-${target.kind}-${target.id}`;
  const [receipts, setReceipts] = useState([]); // read receipts (DMs/groups)
  const [uploading, setUploading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [recording, setRecording] = useState(false);
  const fileRef = useRef(null);
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
  const lastTypingEmit = useRef(0);
  const recorderRef = useRef(null);
  const room = `${target.kind}:${target.id}`;

  const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  // Upload a Blob/File to the server and send it as a message.
  async function uploadAndSend(file, label) {
    const fd = new FormData();
    fd.append('file', file, file.name || 'voice-note.webm');
    const res = await fetch(`${API}/api/uploads`, {
      method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, body: fd,
    });
    const data = await res.json();
    const isImg = (data.mime || '').startsWith('image/');
    const isAudio = (data.mime || '').startsWith('audio/');
    const content = isImg ? `![${data.name}](${data.url})`
      : isAudio ? `[[audio:${data.url}]]`
      : `[${label || '📎 ' + data.name}](${data.url})`;
    const payload = { room, content };
    if (target.kind === 'channel') payload.channelId = target.id; else payload.conversationId = target.id;
    getSocket().emit('message:send', payload);
  }

  // Record a voice note via MediaRecorder, then upload on stop.
  async function toggleRecord() {
    if (recording) { recorderRef.current?.stop(); return; }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const file = new File([blob], 'voice-note.webm', { type: 'audio/webm' });
      await uploadAndSend(file);
      setRecording(false);
    };
    recorderRef.current = rec;
    rec.start();
    setRecording(true);
  }

  // Bookmark / unbookmark a message.
  async function bookmark(id) {
    await api(`/api/bookmarks/${id}`, { method: 'POST' });
  }

  // Forward a message's content into another conversation/channel the user picks.
  async function forward(m) {
    const dest = prompt('Forward to which conversation ID? (paste a conversation id)');
    if (!dest) return;
    await api('/api/conversations', { method: 'POST', body: JSON.stringify({ userIds: [] }) }).catch(() => {});
    getSocket().emit('message:send', { room: `conversation:${dest}`, conversationId: dest, content: `↪️ ${m.content}` });
  }

  const basePath = target.kind === 'channel'
    ? `/api/messages/channel/${target.id}`
    : `/api/conversations/${target.id}/messages`;

  // Load older messages when the user scrolls to the top (infinite scroll).
  async function loadOlder() {
    if (loadingMore || !hasMore || !messages.length) return;
    setLoadingMore(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight || 0;
    try {
      const d = await api(`${basePath}?before=${messages[0].id}`);
      setMessages((prev) => [...d.messages, ...prev]);
      setHasMore(d.hasMore);
      // Preserve scroll position after prepending.
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; });
    } finally {
      setLoadingMore(false);
    }
  }

  function onScroll(e) {
    if (e.target.scrollTop < 40) loadOlder();
  }

  // Mark channel read for unread badges.
  async function syncChannelRead(latestId) {
    if (target.kind !== 'channel' || !latestId) return;
    await api(`/api/messages/channel/${target.id}/read`, { method: 'POST', body: JSON.stringify({ messageId: latestId }) }).catch(() => {});
    onChannelRead?.(target.id);
  }

  // Mark the conversation read + load receipts (conversations only).
  async function syncReceipts(latestId) {
    if (target.kind !== 'conversation') return;
    if (latestId) await api(`/api/conversations/${target.id}/read`, { method: 'POST', body: JSON.stringify({ messageId: latestId }) }).catch(() => {});
    const d = await api(`/api/conversations/${target.id}/receipts`).catch(() => ({ receipts: [] }));
    setReceipts(d.receipts || []);
  }

  // Upload a file and send it as a message (markdown image or link).
  async function onPickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/uploads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: fd,
      });
      const data = await res.json();
      const isImg = (data.mime || '').startsWith('image/');
      const content = isImg ? `![${data.name}](${data.url})` : `[📎 ${data.name}](${data.url})`;
      const payload = { room, content };
      if (target.kind === 'channel') payload.channelId = target.id; else payload.conversationId = target.id;
      getSocket().emit('message:send', payload);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function reactionSummary(reactions = []) {
    const map = {};
    for (const r of reactions) map[r.emoji] = (map[r.emoji] || 0) + 1;
    return map;
  }

  async function refresh() {
    const d = await api(basePath);
    setMessages(d.messages);
    setHasMore(d.hasMore);
  }

  async function react(id, emoji) {
    await api(`/api/messages/${id}/react`, { method: 'POST', body: JSON.stringify({ emoji }) });
    getSocket().emit('reaction:changed', { room, messageId: id });
    refresh();
  }
  async function saveEdit(id) {
    const d = await api(`/api/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ content: editText }) });
    getSocket().emit('message:edited', { room, message: d.message });
    setEditingId(null); refresh();
  }
  async function del(id) {
    await api(`/api/messages/${id}`, { method: 'DELETE' });
    getSocket().emit('message:deleted', { room, messageId: id });
    refresh();
  }
  async function pin(m) {
    const d = await api(`/api/messages/${m.id}/pin`, { method: 'PATCH', body: JSON.stringify({ pinned: !m.pinned }) });
    getSocket().emit('message:pinned', { room, message: d.message });
    refresh();
  }
  async function runSearch(e) {
    e.preventDefault();
    if (target.kind !== 'channel') return; // search API is channel-scoped for now
    const d = await api(`/api/messages/channel/${target.id}/search?q=${encodeURIComponent(search)}`);
    setMessages(d.messages);
  }

  useEffect(() => {
    const socket = getSocket();
    socket.emit('join', room);
    api(basePath).then((d) => { setMessages(d.messages); setHasMore(d.hasMore); });

    const onNew = (m) => {
      const match = target.kind === 'channel' ? m.channelId === target.id : m.conversationId === target.id;
      if (match) {
        setMessages((prev) => [...prev, m]);
        // Notify on messages from others.
        if (m.author?.id !== currentUserId) {
          notifyMessage(true, m.author?.displayName || m.author?.username || 'New message', m.content);
        }
      }
    };
    const onTyping = ({ username }) => {
      setTyping(`${username} is typing...`);
      clearTimeout(window.__t); window.__t = setTimeout(() => setTyping(''), 1500);
    };
    const onChanged = () => refresh();
    socket.on('message:new', onNew);
    socket.on('typing', onTyping);
    socket.on('message:edited', onChanged);
    socket.on('message:deleted', onChanged);
    socket.on('message:pinned', onChanged);
    socket.on('reaction:changed', onChanged);
    return () => {
      socket.emit('leave', room);
      socket.off('message:new', onNew); socket.off('typing', onTyping);
      socket.off('message:edited', onChanged); socket.off('message:deleted', onChanged);
      socket.off('message:pinned', onChanged); socket.off('reaction:changed', onChanged);
    };
  }, [room, target.id, target.kind]);

  useEffect(() => {
    if (messages.length) {
      const latest = messages[messages.length - 1].id;
      syncReceipts(latest);
      syncChannelRead(latest);
    }
  }, [messages]);

  // Load any saved draft when switching targets.
  useEffect(() => {
    setText(localStorage.getItem(draftKey) || '');
  }, [draftKey]);

  // Persist the draft as the user types (cleared on send).
  // Typing events are throttled so we emit at most once every ~1.5s.
  function onChangeText(v) {
    setText(v);
    if (v) localStorage.setItem(draftKey, v); else localStorage.removeItem(draftKey);
    const now = Date.now();
    if (now - lastTypingEmit.current > 1500) {
      lastTypingEmit.current = now;
      getSocket().emit('typing', { room });
    }
  }

  function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const payload = { room, content: text };
    if (target.kind === 'channel') payload.channelId = target.id; else payload.conversationId = target.id;
    getSocket().emit('message:send', payload);
    setText('');
    localStorage.removeItem(draftKey);
  }

  // Schedule the current text for future delivery.
  async function scheduleSend() {
    if (!text.trim() || !scheduleAt) return;
    const body = { content: text, sendAt: new Date(scheduleAt).toISOString() };
    if (target.kind === 'channel') body.channelId = target.id; else body.conversationId = target.id;
    try {
      await api('/api/scheduled', { method: 'POST', body: JSON.stringify(body) });
      setText(''); localStorage.removeItem(draftKey);
      setShowSchedule(false); setScheduleAt('');
    } catch (e) { alert(e.message); }
  }

  return (
    <div className="flex h-full flex-1">
    <div className="flex h-full flex-1 flex-col bg-[var(--bg-2)] text-[var(--text)]">
      <header className="flex items-center gap-2 border-b border-black/20 px-4 py-3 font-semibold">
        <span className="text-[var(--muted)]">{target.kind === 'channel' ? '#' : '@'}</span>{target.name}
        <div className="ml-auto flex items-center gap-2">
          {headerActions}
          <button onClick={() => setShowPins((p) => !p)} title="Pinned messages"
            className="rounded px-2 py-1 text-sm hover:bg-[var(--bg-3)]">📌</button>
          {target.kind === 'channel' && (
            <button onClick={() => { setShowSearch((s) => !s); if (showSearch) refresh(); }}
              title="Search" className="rounded px-2 py-1 text-sm hover:bg-[var(--bg-3)]">🔍</button>
          )}
        </div>
      </header>
      {showPins && <Pins target={target} onClose={() => setShowPins(false)} />}
      {showSearch && (
        <form onSubmit={runSearch} className="border-b border-black/20 p-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this channel"
            className="w-full rounded bg-[var(--bg-3)] px-3 py-2 text-sm outline-none" />
        </form>
      )}
      <div ref={scrollRef} onScroll={onScroll} className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4">
        {loadingMore && <p className="text-center text-xs text-[var(--muted)]">Loading older messages…</p>}
        {!hasMore && messages.length > 0 && <p className="text-center text-xs text-[var(--muted)]">Beginning of conversation</p>}
        {messages.map((m) => {
          const mine = m.author?.id === currentUserId;
          const summary = reactionSummary(m.reactions);
          return (
          <div key={m.id} className="group rounded px-1 hover:bg-black/10">
            <div className="flex items-baseline gap-2">
              <button onClick={() => m.author?.username && setProfileUser(m.author.username)}
                className="font-semibold hover:underline">{m.author?.displayName || m.author?.username}</button>
              {m.editedAt && <span className="text-xs text-[var(--muted)]">(edited)</span>}
              {m.pinned && <span className="text-xs text-yellow-400">📌 pinned</span>}
              {/* Hover actions */}
              <span className="ml-auto hidden gap-1 group-hover:flex">
                {QUICK_EMOJI.slice(0, 3).map((e) => (
                  <button key={e} onClick={() => react(m.id, e)} className="rounded px-1 hover:bg-[var(--bg-3)]">{e}</button>
                ))}
                <button onClick={() => setThread(m)} title="Reply in thread" className="rounded px-1 hover:bg-[var(--bg-3)]">💬</button>
                <button onClick={() => pin(m)} title="Pin" className="rounded px-1 hover:bg-[var(--bg-3)]">📌</button>
                <button onClick={() => bookmark(m.id)} title="Bookmark" className="rounded px-1 hover:bg-[var(--bg-3)]">🔖</button>
                <button onClick={() => forward(m)} title="Forward" className="rounded px-1 hover:bg-[var(--bg-3)]">↪️</button>
                {mine && <button onClick={() => { setEditingId(m.id); setEditText(m.content); }} title="Edit" className="rounded px-1 hover:bg-[var(--bg-3)]">✏️</button>}
                {mine && <button onClick={() => del(m.id)} title="Delete" className="rounded px-1 text-red-400 hover:bg-[var(--bg-3)]">🗑️</button>}
              </span>
            </div>
            {editingId === m.id ? (
              <div className="flex gap-2">
                <input value={editText} onChange={(e) => setEditText(e.target.value)}
                  className="flex-1 rounded bg-[var(--bg-3)] px-2 py-1" />
                <button onClick={() => saveEdit(m.id)} className="rounded bg-[var(--accent)] px-3 text-sm">Save</button>
                <button onClick={() => setEditingId(null)} className="text-sm text-[var(--muted)]">Cancel</button>
              </div>
            ) : POLL_RE.test(m.content) ? (
              <Poll pollId={m.content.match(POLL_RE)[1]} />
            ) : AUDIO_RE.test(m.content) ? (
              <audio controls src={m.content.match(AUDIO_RE)[1]} className="mt-1" />
            ) : (
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown components={{ img: ({ node, ...props }) => <img {...props} className="max-h-64 rounded-lg" /> }}>
                  {m.content}
                </ReactMarkdown>
              </div>
            )}
            {Object.keys(summary).length > 0 && (
              <div className="mt-1 flex gap-1">
                {Object.entries(summary).map(([emoji, count]) => (
                  <button key={emoji} onClick={() => react(m.id, emoji)}
                    className="rounded-full bg-[var(--bg-0)] px-2 text-xs">{emoji} {count}</button>
                ))}
              </div>
            )}
            {(m._count?.replies || 0) > 0 ? (
              <button onClick={() => setThread(m)} className="mt-1 text-xs text-[var(--accent)] hover:underline">
                💬 {m._count.replies} {m._count.replies === 1 ? 'reply' : 'replies'}
              </button>
            ) : null}
          </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {/* Read receipts (conversations): show others who have read the latest message */}
      {target.kind === 'conversation' && messages.length > 0 && (
        <div className="px-4 text-right text-xs text-[var(--muted)]">
          {receipts
            .filter((r) => r.userId !== currentUserId && r.lastReadMessageId === messages[messages.length - 1].id)
            .map((r) => `✓ Seen by ${r.user.displayName || r.user.username}`)
            .join('  ')}
        </div>
      )}
      <div className="h-5 px-4 text-xs text-[var(--muted)]">{typing}</div>
      {showSchedule && (
        <div className="flex items-center gap-2 px-4 pb-2 text-sm">
          <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)}
            className="rounded bg-[var(--bg-3)] px-2 py-1 outline-none" />
          <button onClick={scheduleSend} className="rounded bg-[var(--accent)] px-3 py-1 text-white">Schedule</button>
          <button onClick={() => setShowSchedule(false)} className="text-[var(--muted)]">Cancel</button>
        </div>
      )}
      <form onSubmit={send} className="flex items-center gap-2 p-4 pt-0">
        <input ref={fileRef} type="file" className="hidden" onChange={onPickFile} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          title="Attach file" className="rounded-lg bg-[var(--bg-3)] px-3 py-3 text-lg disabled:opacity-50">
          {uploading ? '…' : '📎'}
        </button>
        <input value={text}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder={`Message ${target.kind === 'channel' ? '#' : '@'}${target.name}`}
          className="flex-1 rounded-lg bg-[var(--bg-3)] px-4 py-3 outline-none" />
        <button type="button" onClick={() => setShowCreatePoll(true)} title="Create poll"
          className="rounded-lg bg-[var(--bg-3)] px-3 py-3 text-lg">📊</button>
        <button type="button" onClick={() => setShowSchedule((s) => !s)} title="Schedule message"
          className="rounded-lg bg-[var(--bg-3)] px-3 py-3 text-lg">⏰</button>
        <button type="button" onClick={() => setShowScheduledPanel(true)} title="Scheduled messages"
          className="rounded-lg bg-[var(--bg-3)] px-3 py-3 text-lg">🗓️</button>
        <button type="button" onClick={toggleRecord} title="Voice note"
          className={`rounded-lg px-3 py-3 text-lg ${recording ? 'bg-red-600' : 'bg-[var(--bg-3)]'}`}>{recording ? '⏹️' : '🎤'}</button>
      </form>
      {showCreatePoll && <CreatePoll target={target} onClose={() => setShowCreatePoll(false)} />}
      {showScheduledPanel && <ScheduledPanel onClose={() => setShowScheduledPanel(false)} />}
      {profileUser && (
        <ProfileCard username={profileUser} onClose={() => setProfileUser(null)} onMessage={onMessageUser} />
      )}
    </div>
    {thread && <ThreadPanel parent={thread} target={target} onClose={() => setThread(null)} />}
    </div>
  );
}
