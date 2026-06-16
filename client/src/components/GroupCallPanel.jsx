import React, { useEffect, useRef } from 'react';
import CallControls from './CallControls.jsx';

// One video tile bound to a MediaStream.
function RemoteTile({ username, stream, audioOnly }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return (
    <div className="relative overflow-hidden rounded-lg bg-gray-800">
      <video ref={ref} autoPlay playsInline className={`h-40 w-full object-cover ${audioOnly ? 'hidden' : ''}`} />
      {audioOnly && <div className="flex h-40 items-center justify-center text-3xl">🎤</div>}
      <span className="absolute bottom-1 left-2 text-xs text-white drop-shadow">{username}</span>
    </div>
  );
}

// Grid overlay for an active group (mesh) call.
export default function GroupCallPanel({ group }) {
  const { active, media, remotes, localRef, leave } = group;
  if (!active) return null;
  const audioOnly = media !== 'video';
  const entries = Object.entries(remotes);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black/90 p-4 text-white">
      <p className="mb-2 text-sm text-gray-300">Group {media} call — {entries.length + 1} participant{entries.length ? 's' : ''}</p>
      <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto md:grid-cols-3">
        {/* Local tile */}
        <div className="relative overflow-hidden rounded-lg bg-gray-700">
          <video ref={localRef} autoPlay playsInline muted className={`h-40 w-full object-cover ${audioOnly ? 'hidden' : ''}`} />
          {audioOnly && <div className="flex h-40 items-center justify-center text-3xl">🎤</div>}
          <span className="absolute bottom-1 left-2 text-xs">You</span>
        </div>
        {entries.map(([userId, r]) => (
          <RemoteTile key={userId} username={r.username} stream={r.stream} audioOnly={audioOnly} />
        ))}
      </div>
      <div className="mt-3">
        <CallControls call={group} isVideo={media === 'video'} onEnd={leave} endLabel="Leave call" />
      </div>
    </div>
  );
}
