import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from '../api';
import { getSocket } from '../socket';

// Side panel showing replies to a parent message. Replies are messages with parentId set.
export default function ThreadPanel({ parent, target, onClose }) {
  const [replies, setReplies] = useState([]);
  const [text, setText] = useState('');
  const room = `${target.kind}:${target.id}`;

  async function load() {
    const d = await api(`/api/messages/thread/${parent.id}`);
    setReplies(d.messages);
  }
  useEffect(() => { load(); }, [parent.id]);

  useEffect(() => {
    const socket = getSocket();
    const onNew = (m) => { if (m.parentId === parent.id) setReplies((p) => [...p, m]); };
    socket.on('message:new', onNew);
    return () => socket.off('message:new', onNew);
  }, [parent.id]);

  function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const payload = { room, content: text, parentId: parent.id };
    if (target.kind === 'channel') payload.channelId = target.id; else payload.conversationId = target.id;
    getSocket().emit('message:send', payload);
    setText('');
  }

  return (
    <div className="flex w-80 flex-col border-l border-black/20 bg-[var(--bg-2)] text-[var(--text)]">
      <header className="flex items-center justify-between border-b border-black/20 px-3 py-3">
        <span className="font-semibold">Thread</span>
        <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--text)]">✕</button>
      </header>
      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto p-3">
        {/* Parent message */}
        <div className="rounded bg-[var(--bg-1)] p-2">
          <p className="text-sm font-semibold">{parent.author?.displayName || parent.author?.username}</p>
          <div className="prose prose-invert prose-sm max-w-none"><ReactMarkdown>{parent.content}</ReactMarkdown></div>
        </div>
        {replies.map((m) => (
          <div key={m.id}>
            <p className="text-sm font-semibold">{m.author?.displayName || m.author?.username}</p>
            <div className="prose prose-invert prose-sm max-w-none"><ReactMarkdown>{m.content}</ReactMarkdown></div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="p-3">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply..."
          className="w-full rounded-lg bg-[var(--bg-3)] px-3 py-2 outline-none" />
      </form>
    </div>
  );
}
