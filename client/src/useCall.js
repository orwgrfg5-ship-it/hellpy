import { useEffect, useRef, useState } from 'react';
import { getSocket } from './socket';

// Public STUN servers. For production / cross-network calls add a TURN server here.
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// 1:1 WebRTC call hook driven by Socket.IO signaling.
// Returns call state plus start/accept/end controls and media stream refs.
export function useCall(selfUserId) {
  const [state, setState] = useState('idle'); // idle | calling | ringing | in-call
  const [peerUserId, setPeerUserId] = useState(null);
  const [media, setMedia] = useState('audio');
  const [incoming, setIncoming] = useState(null); // { fromUserId, fromUsername, offer, media }
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const pc = useRef(null);
  const localStream = useRef(null);
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const cameraTrack = useRef(null); // saved camera track while screen sharing

  function newPeer(toUserId) {
    const peer = new RTCPeerConnection(ICE);
    peer.onicecandidate = (e) => {
      if (e.candidate) getSocket().emit('call:ice', { toUserId, candidate: e.candidate });
    };
    peer.ontrack = (e) => { if (remoteRef.current) remoteRef.current.srcObject = e.streams[0]; };
    pc.current = peer;
    return peer;
  }

  async function getMedia(kind) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
    localStream.current = stream;
    if (localRef.current) localRef.current.srcObject = stream;
    return stream;
  }

  async function startCall(toUserId, kind = 'audio') {
    setMedia(kind); setPeerUserId(toUserId); setState('calling');
    const peer = newPeer(toUserId);
    const stream = await getMedia(kind);
    stream.getTracks().forEach((t) => peer.addTrack(t, stream));
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    getSocket().emit('call:offer', { toUserId, offer, media: kind });
  }

  async function accept() {
    if (!incoming) return;
    const toUserId = incoming.fromUserId;
    setMedia(incoming.media); setPeerUserId(toUserId); setState('in-call');
    const peer = newPeer(toUserId);
    const stream = await getMedia(incoming.media);
    stream.getTracks().forEach((t) => peer.addTrack(t, stream));
    await peer.setRemoteDescription(incoming.offer);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    getSocket().emit('call:answer', { toUserId, answer });
    setIncoming(null);
  }

  function end() {
    if (peerUserId) getSocket().emit('call:end', { toUserId: peerUserId });
    cleanup();
  }

  function cleanup() {
    pc.current?.close(); pc.current = null;
    localStream.current?.getTracks().forEach((t) => t.stop());
    cameraTrack.current?.stop(); cameraTrack.current = null;
    localStream.current = null;
    setState('idle'); setPeerUserId(null); setIncoming(null);
    setMuted(false); setCameraOff(false); setSharing(false);
  }

  // Toggle local microphone.
  function toggleMute() {
    const track = localStream.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }

  // Toggle local camera.
  function toggleCamera() {
    const track = localStream.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOff(!track.enabled);
  }

  // Replace the outgoing video track with a screen-share track (or restore camera).
  async function toggleScreenShare() {
    const sender = pc.current?.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (!sender) return;
    if (!sharing) {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = display.getVideoTracks()[0];
      cameraTrack.current = sender.track; // keep camera to restore later
      await sender.replaceTrack(screenTrack);
      if (localRef.current) localRef.current.srcObject = display;
      screenTrack.onended = () => toggleScreenShare(); // auto-restore when user stops sharing
      setSharing(true);
    } else {
      const cam = cameraTrack.current;
      if (cam) await sender.replaceTrack(cam);
      if (localRef.current) localRef.current.srcObject = localStream.current;
      cameraTrack.current = null;
      setSharing(false);
    }
  }

  useEffect(() => {
    const socket = getSocket();
    const onIncoming = (data) => { setIncoming(data); setState('ringing'); };
    const onAnswered = async ({ answer }) => {
      if (pc.current) { await pc.current.setRemoteDescription(answer); setState('in-call'); }
    };
    const onIce = async ({ candidate }) => {
      try { await pc.current?.addIceCandidate(candidate); } catch (e) { /* ignore */ }
    };
    const onEnded = () => cleanup();
    socket.on('call:incoming', onIncoming);
    socket.on('call:answered', onAnswered);
    socket.on('call:ice', onIce);
    socket.on('call:ended', onEnded);
    return () => {
      socket.off('call:incoming', onIncoming); socket.off('call:answered', onAnswered);
      socket.off('call:ice', onIce); socket.off('call:ended', onEnded);
    };
  }, []);

  return {
    state, media, incoming, peerUserId, localRef, remoteRef,
    muted, cameraOff, sharing,
    startCall, accept, end, toggleMute, toggleCamera, toggleScreenShare,
  };
}
