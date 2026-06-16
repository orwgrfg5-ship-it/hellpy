import React from 'react';

// Small static emoji palette for reactions. No external dependency.
const EMOJIS = ['👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '👀',
  '🙏', '👏', '🤔', '😍', '🙌', '✅', '❌', '⚠️', '🚀', '💯',
  '😎', '🥳', '🙅', '👌', '🙃', '💡', '🐛', '🎯', '⭐', '🌈'];

export default function EmojiPicker({ onPick, onClose }) {
  return (
    <div className="absolute bottom-6 right-0 z-20 grid w-56 grid-cols-6 gap-1 rounded-lg bg-[var(--bg-0)] p-2 shadow-2xl"
      onMouseLeave={onClose}>
      {EMOJIS.map((e) => (
        <button key={e} onClick={() => { onPick(e); onClose(); }} className="rounded p-1 text-lg hover:bg-[var(--bg-3)]">{e}</button>
      ))}
    </div>
  );
}
