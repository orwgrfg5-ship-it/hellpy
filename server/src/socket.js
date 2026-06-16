const { verifyToken } = require('./auth');
const prisma = require('./prisma');

// Wires up real-time messaging, typing indicators, and read receipts.
function initSocket(io) {
  // Authenticate sockets via JWT passed in handshake auth.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      socket.user = verifyToken(token);
      next();
    } catch (err) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    // Join a channel or conversation room.
    socket.on('join', (room) => socket.join(room));
    socket.on('leave', (room) => socket.leave(room));

    // Typing indicator broadcast.
    socket.on('typing', ({ room }) => {
      socket.to(room).emit('typing', { userId: socket.user.id, username: socket.user.username });
    });

    // Send a message to a channel or conversation.
    socket.on('message:send', async (payload, ack) => {
      try {
        const { room, channelId, conversationId, content, parentId } = payload;
        if (!content || (!channelId && !conversationId)) {
          return ack?.({ error: 'Invalid payload' });
        }
        const message = await prisma.message.create({
          data: {
            authorId: socket.user.id,
            content,
            channelId: channelId || null,
            conversationId: conversationId || null,
            parentId: parentId || null,
          },
          include: { author: { select: { id: true, username: true, displayName: true } } },
        });
        io.to(room).emit('message:new', message);
        ack?.({ message });
      } catch (err) {
        ack?.({ error: 'Failed to send' });
      }
    });

    // Read receipt broadcast.
    socket.on('message:read', ({ room, messageId }) => {
      socket.to(room).emit('message:read', { userId: socket.user.id, messageId });
    });

    // --- Live message-event relays (the REST routes persist; these notify the room) ---
    socket.on('message:edited', ({ room, message }) => socket.to(room).emit('message:edited', message));
    socket.on('message:deleted', ({ room, messageId }) => socket.to(room).emit('message:deleted', { messageId }));
    socket.on('message:pinned', ({ room, message }) => socket.to(room).emit('message:pinned', message));
    socket.on('reaction:changed', ({ room, messageId }) => socket.to(room).emit('reaction:changed', { messageId }));

    // --- WebRTC 1:1 call signaling ---
    // Each user has a personal room (user:<id>) for receiving call offers.
    socket.join(`user:${socket.user.id}`);

    // Caller invites a callee. We relay the SDP offer to the callee's personal room.
    socket.on('call:offer', ({ toUserId, offer, media }) => {
      io.to(`user:${toUserId}`).emit('call:incoming', {
        fromUserId: socket.user.id,
        fromUsername: socket.user.username,
        offer,
        media, // 'audio' | 'video'
      });
    });

    // Callee answers with an SDP answer.
    socket.on('call:answer', ({ toUserId, answer }) => {
      io.to(`user:${toUserId}`).emit('call:answered', { fromUserId: socket.user.id, answer });
    });

    // Trickle ICE candidates both directions.
    socket.on('call:ice', ({ toUserId, candidate }) => {
      io.to(`user:${toUserId}`).emit('call:ice', { fromUserId: socket.user.id, candidate });
    });

    // Hang up / decline.
    socket.on('call:end', ({ toUserId }) => {
      io.to(`user:${toUserId}`).emit('call:ended', { fromUserId: socket.user.id });
    });

    // --- Group call signaling (mesh) ---
    // Members join a call room (call:<conversationId>). Existing members are
    // returned so the newcomer can create a peer connection to each of them.
    // NOTE: a full mesh scales poorly past ~4-5 participants. For larger calls,
    // route media through an SFU (LiveKit / mediasoup) instead of peer-to-peer.
    socket.on('group-call:join', ({ callId }, ack) => {
      const roomName = `call:${callId}`;
      const existing = Array.from(io.sockets.adapter.rooms.get(roomName) || [])
        .map((sid) => io.sockets.sockets.get(sid))
        .filter(Boolean)
        .map((s) => ({ userId: s.user.id, username: s.user.username }));
      socket.join(roomName);
      socket.callId = callId;
      // Tell existing members someone joined.
      socket.to(roomName).emit('group-call:peer-joined', { userId: socket.user.id, username: socket.user.username });
      ack?.({ peers: existing });
    });

    // Relay SDP/ICE between two specific peers in the group call.
    socket.on('group-call:signal', ({ toUserId, data }) => {
      io.to(`user:${toUserId}`).emit('group-call:signal', { fromUserId: socket.user.id, data });
    });

    socket.on('group-call:leave', ({ callId }) => {
      const roomName = `call:${callId}`;
      socket.leave(roomName);
      socket.to(roomName).emit('group-call:peer-left', { userId: socket.user.id });
    });

    socket.on('disconnect', () => {
      if (socket.callId) {
        socket.to(`call:${socket.callId}`).emit('group-call:peer-left', { userId: socket.user.id });
      }
      // Mark user offline on disconnect (best-effort).
      prisma.user.update({ where: { id: socket.user.id }, data: { presence: 'OFFLINE', lastSeenAt: new Date() } }).catch(() => {});
    });
  });
}

module.exports = { initSocket };
