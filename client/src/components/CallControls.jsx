import React from 'react';

// Shared in-call control bar: mute, camera (video calls only), screen share, end.
// `call` exposes muted/cameraOff/sharing + toggleMute/toggleCamera/toggleScreenShare and an end fn.
export default function CallControls({ call, isVideo, onEnd, endLabel = 'End' }) {
  const btn = 'flex h-12 w-12 items-center justify-center rounded-full text-lg';
  return (
    <div className="flex items-center justify-center gap-3">
      <button onClick={call.toggleMute} title={call.muted ? 'Unmute' : 'Mute'}
        className={`${btn} ${call.muted ? 'bg-red-600' : 'bg-gray-700'}`}>{call.muted ? '🔇' : '🎤'}</button>
      {isVideo && (
        <button onClick={call.toggleCamera} title={call.cameraOff ? 'Turn camera on' : 'Turn camera off'}
          className={`${btn} ${call.cameraOff ? 'bg-red-600' : 'bg-gray-700'}`}>{call.cameraOff ? '🚫' : '📹'}</button>
      )}
      <button onClick={call.toggleScreenShare} title="Share screen"
        className={`${btn} ${call.sharing ? 'bg-green-600' : 'bg-gray-700'}`}>🖥️</button>
      <button onClick={onEnd} title={endLabel} className={`${btn} bg-red-600`}>📞</button>
    </div>
  );
}
