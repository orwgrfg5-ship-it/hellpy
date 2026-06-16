import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from './socket';

// For cross-network calls, add a TURN server to this list.
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Mesh group-call hook: maintains one RTCPeerConnection per remote participant.
// Signaling flows over the server's `group-call:*` socket events.
// Suitable for small calls (~4-5). For larger calls, swap the transport for an SFU.
export function useGroupCall(selfUserId) {
  const [active, setActive] = useState(false);
  const [media, setMedia] = useState('audio');
  const [callId, setCallId] = useState(null);
  // remotes: { [userId]: { username, stream } }
  const [remotes, setRemotes] = useState({});
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const peers = useRef({});       // userId -> RTCPeerConnection
  const localStream = useRef(null);
  const localRef = useRef(null);
  const cameraTrack = useRef(null);

  const addRemoteStream = useCallback((userId, username, stream) => {
    setRemotes((r) => ({ ...r, [userId]: { username, stream } }));
  }, []);

  function createPeer(remoteUserId, username) {
    const pc = new RTCPeerConnection(ICE);
    localStream.current?.getTracks().forEach((t) => pc.addTrack(t, localStream.current));
    pc.onicecandidate = (e) => {
      if (e.candidate) getSocket().emit('group-call:signal', { toUserId: remoteUserId, data: { candidate: e.candidate } });
    };
    pc.ontrack = (e) => addRemoteStream(remoteUserId, username, e.streams[0]);
    peers.current[remoteUserId] = pc;
    return pc;
  }

  async function join(id, kind = 'audio') {
    setMedia(kind); setCallId(id); setActive(true);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
    localStream.current = stream;
    if (localRef.current) localRef.current.srcObject = stream;

    const socket = getSocket();
    // Join the call room; server returns the peers already present.
    socket.emit('group-call:join', { callId: id }, async (resp) => {
      const existing = resp?.peers || [];
      // We initiate an offer to each existing peer.
      for (const p of existing) {
        if (p.userId === selfUserId) continue;
        const pc = createPeer(p.userId, p.username);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('group-call:signal', { toUserId: p.userId, data: { offer, username: p.username } });
      }
    });
  }

  function leave() {
    if (callId) getSocket().emit('group-call:leave', { callId });
    Object.values(peers.current).forEach((pc) => pc.close());
    peers.current = {};
    localStream.current?.getTracks().forEach((t) => t.stop());
    cameraTrack.current?.stop(); cameraTrack.current = null;
    localStream.current = null;
    setRemotes({}); setActive(false); setCallId(null);
    setMuted(false); setCameraOff(false); setSharing(false);
  }

  function toggleMute() {
    const track = localStream.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }

  function toggleCamera() {
    const track = localStream.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOff(!track.enabled);
  }

  // Replace the outgoing video track on every peer connection with a screen track.
  async function toggleScreenShare() {
    const senders = Object.values(peers.current)
      .map((pc) => pc.getSenders().find((s) => s.track && s.track.kind === 'video'))
      .filter(Boolean);
    if (!sharing) {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = display.getVideoTracks()[0];
      cameraTrack.current = localStream.current?.getVideoTracks()[0] || null;
      for (const s of senders) await s.replaceTrack(screenTrack);
      if (localRef.current) localRef.current.srcObject = display;
      screenTrack.onended = () => toggleScreenShare();
      setSharing(true);
    } else {
      const cam = cameraTrack.current;
      for (const s of senders) { if (cam) await s.replaceTrack(cam); }
      if (localRef.current) localRef.current.srcObject = localStream.current;
      cameraTrack.current = null;
      setSharing(false);
    }
  }

  useEffect(() => {
    const socket = getSocket();

    // A new peer joined after us: wait for their offer (they initiate to us).
    const onPeerJoined = ({ userId, username }) => { /* offer will arrive via signal */ };

    const onSignal = async ({ fromUserId, data }) => {
      let pc = peers.current[fromUserId];
      if (data.offer) {
        if (!pc) pc = createPeer(fromUserId, data.username || 'peer');
        await pc.setRemoteDescription(data.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('group-call:signal', { toUserId: fromUserId, data: { answer } });
      } else if (data.answer) {
        await pc?.setRemoteDescription(data.answer);
      } else if (data.candidate) {
        try { await pc?.addIceCandidate(data.candidate); } catch (e) { /* ignore */ }
      }
    };

    const onPeerLeft = ({ userId }) => {
      peers.current[userId]?.close();
      delete peers.current[userId];
      setRemotes((r) => { const n = { ...r }; delete n[userId]; return n; });
    };

    socket.on('group-call:peer-joined', onPeerJoined);
    socket.on('group-call:signal', onSignal);
    socket.on('group-call:peer-left', onPeerLeft);
    return () => {
      socket.off('group-call:peer-joined', onPeerJoined);
      socket.off('group-call:signal', onSignal);
      socket.off('group-call:peer-left', onPeerLeft);
    };
  }, [selfUserId]);

  return {
    active, media, remotes, localRef, muted, cameraOff, sharing,
    join, leave, toggleMute, toggleCamera, toggleScreenShare,
  };
}
