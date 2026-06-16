// Lightweight notification helpers: a synthesized beep + desktop notifications.
// No external assets needed; the beep uses the Web Audio API.

let audioCtx;

export function playBeep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.26);
  } catch (e) { /* ignore */ }
}

export async function ensureNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const res = await Notification.requestPermission();
    return res === 'granted';
  }
  return false;
}

export function showDesktopNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    try { new Notification(title, { body }); } catch (e) { /* ignore */ }
  }
}

// Called for any incoming message not authored by the current user.
export function notifyMessage(prefsOn, author, content) {
  if (!prefsOn) return;
  playBeep();
  showDesktopNotification(author, content?.slice(0, 120) || '');
}
