import React, { useState } from 'react';
import { api } from '../api';
import { getSocket } from '../socket';

// Modal to compose a poll; on create it also posts a message referencing the poll
// so it shows inline in the conversation/channel.
export default function CreatePoll({ target, onClose }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);

  function setOpt(i, v) { setOptions((o) => o.map((x, idx) => (idx === i ? v : x))); }

  async function create() {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || opts.length < 2) return;
    const body = { question, options: opts, multiple };
    if (target.kind === 'channel') body.channelId = target.id; else body.conversationId = target.id;
    const d = await api('/api/polls', { method: 'POST', body: JSON.stringify(body) });
    // Post an inline message carrying the poll id; the renderer turns this into a Poll.
    const room = `${target.kind}:${target.id}`;
    const payload = { room, content: `[[poll:${d.poll.id}]]` };
    if (target.kind === 'channel') payload.channelId = target.id; else payload.conversationId = target.id;
    getSocket().emit('message:send', payload);
    onClose();
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-96 rounded-xl bg-[var(--bg-2)] p-5 text-[var(--text)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-lg font-bold">Create poll</h3>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Question"
          className="mb-3 w-full rounded bg-[var(--bg-3)] px-3 py-2 outline-none" />
        <div className="space-y-2">
          {options.map((o, i) => (
            <input key={i} value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Option ${i + 1}`}
              className="w-full rounded bg-[var(--bg-3)] px-3 py-2 outline-none" />
          ))}
        </div>
        {options.length < 10 && (
          <button onClick={() => setOptions((o) => [...o, ''])} className="mt-2 text-sm text-[var(--accent)]">+ Add option</button>
        )}
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} /> Allow multiple choices
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-4 py-2 text-[var(--muted)]">Cancel</button>
          <button onClick={create} className="rounded bg-[var(--accent)] px-4 py-2 font-medium text-white">Create</button>
        </div>
      </div>
    </div>
  );
}
