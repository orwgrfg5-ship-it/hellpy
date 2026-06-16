import React, { useEffect, useState } from 'react';
import { api } from '../api';

// Renders a poll with live results and lets the user vote.
export default function Poll({ pollId }) {
  const [poll, setPoll] = useState(null);

  async function load() { setPoll(await api(`/api/polls/${pollId}`).then((d) => d.poll).catch(() => null)); }
  useEffect(() => { load(); }, [pollId]);

  async function vote(optionId) {
    const d = await api(`/api/polls/${pollId}/vote`, { method: 'POST', body: JSON.stringify({ optionId }) });
    setPoll(d.poll);
  }

  if (!poll) return null;
  const closed = poll.closesAt && new Date(poll.closesAt) < new Date();

  return (
    <div className="mt-1 max-w-md rounded-lg border border-white/10 bg-[var(--bg-1)] p-3">
      <p className="mb-2 font-semibold">📊 {poll.question}</p>
      <div className="space-y-2">
        {poll.options.map((o) => {
          const pct = poll.totalVotes ? Math.round((o.count / poll.totalVotes) * 100) : 0;
          return (
            <button key={o.id} onClick={() => !closed && vote(o.id)} disabled={closed}
              className={`relative block w-full overflow-hidden rounded border px-3 py-1 text-left text-sm ${o.votedByMe ? 'border-[var(--accent)]' : 'border-white/10'}`}>
              <span className="absolute inset-0 bg-[var(--accent)]/20" style={{ width: `${pct}%` }} />
              <span className="relative flex justify-between">
                <span>{o.votedByMe ? '✅ ' : ''}{o.text}</span>
                <span className="text-[var(--muted)]">{pct}% · {o.count}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">{poll.totalVotes} vote{poll.totalVotes === 1 ? '' : 's'}{poll.multiple ? ' · multiple choice' : ''}{closed ? ' · closed' : ''}</p>
    </div>
  );
}
