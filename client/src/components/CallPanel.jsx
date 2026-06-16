import React from 'react';
import CallControls from './CallControls.jsx';

// Renders the active/incoming call overlay. Driven by the useCall hook from Chat.
export default function CallPanel({ call }) {
  const { state, media, incoming, localRef, remoteRef, accept, end } = call;
  if (state === 'idle') return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 text-white">
      {state === 'ringing' && incoming && (
        <div className="text-center">
          <p className="mb-4 text-lg">Incoming {incoming.media} call from <b>{incoming.fromUsername}</b></p>
          <div className="flex gap-3">
            <button onClick={accept} className="rounded-full bg-green-600 px-6 py-3 font-semibold">Accept</button>
            <button onClick={end} className="rounded-full bg-red-600 px-6 py-3 font-semibold">Decline</button>
          </div>
        </div>
      )}

      {(state === 'calling' || state === 'in-call') && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-gray-300">{state === 'calling' ? 'Calling...' : `In ${media} call`}</p>
          <div className="flex gap-4">
            {media === 'video' && (
              <>
                <video ref={remoteRef} autoPlay playsInline className="h-64 w-80 rounded-lg bg-gray-800" />
                <video ref={localRef} autoPlay playsInline muted className="h-32 w-44 self-end rounded-lg bg-gray-700" />
              </>
            )}
          </div>
          {/* Audio is played via the hidden remote element even for voice calls */}
          {media !== 'video' && <audio ref={remoteRef} autoPlay />}
          <CallControls call={call} isVideo={media === 'video'} onEnd={end} endLabel="Hang up" />
        </div>
      )}
    </div>
  );
}
