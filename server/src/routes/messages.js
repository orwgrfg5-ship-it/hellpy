const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// Fetch messages for a channel (top-level only) with reply counts.
// Pagination: pass ?before=<messageId> to load older messages (returns up to `limit`, default 50).
router.get('/channel/:channelId', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const before = req.query.before ? await prisma.message.findUnique({ where: { id: req.query.before.toString() } }) : null;
  const messages = await prisma.message.findMany({
    where: {
      channelId: req.params.channelId,
      parentId: null,
      deletedAt: null,
      ...(before ? { createdAt: { lt: before.createdAt } } : {}),
    },
    include: {
      author: { select: { id: true, username: true, displayName: true } },
      reactions: true,
      _count: { select: { replies: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  // Return chronological (oldest first); `hasMore` signals more history exists.
  res.json({ messages: messages.reverse(), hasMore: messages.length === limit });
});

// List pinned messages in a channel.
router.get('/channel/:channelId/pins', async (req, res) => {
  const messages = await prisma.message.findMany({
    where: { channelId: req.params.channelId, pinned: true, deletedAt: null },
    include: { author: { select: { id: true, username: true, displayName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ messages });
});

// Mark a channel read (unread badges).
router.post('/channel/:channelId/read', async (req, res) => {
  await prisma.channelReadState.upsert({
    where: { channelId_userId: { channelId: req.params.channelId, userId: req.user.id } },
    create: { channelId: req.params.channelId, userId: req.user.id, lastReadMessageId: req.body.messageId || null },
    update: { lastReadMessageId: req.body.messageId || null, lastReadAt: new Date() },
  });
  res.json({ ok: true });
});

// Unread counts per channel for the current user across all their servers.
router.get('/unread', async (req, res) => {
  const memberships = await prisma.serverMember.findMany({ where: { userId: req.user.id }, select: { serverId: true } });
  const channels = await prisma.channel.findMany({
    where: { serverId: { in: memberships.map((m) => m.serverId) } },
    select: { id: true, readStates: { where: { userId: req.user.id }, select: { lastReadAt: true } } },
  });
  const result = {};
  for (const ch of channels) {
    const since = ch.readStates[0]?.lastReadAt || new Date(0);
    const count = await prisma.message.count({
      where: { channelId: ch.id, deletedAt: null, createdAt: { gt: since }, authorId: { not: req.user.id } },
    });
    result[ch.id] = count;
  }
  res.json({ unread: result });
});

// Fetch a thread (replies of a parent message).
router.get('/thread/:parentId', async (req, res) => {
  const messages = await prisma.message.findMany({
    where: { parentId: req.params.parentId, deletedAt: null },
    include: { author: { select: { id: true, username: true, displayName: true } }, reactions: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ messages });
});

// Search messages by text within a channel.
router.get('/channel/:channelId/search', async (req, res) => {
  const q = (req.query.q || '').toString();
  const messages = await prisma.message.findMany({
    where: { channelId: req.params.channelId, deletedAt: null, content: { contains: q, mode: 'insensitive' } },
    include: { author: { select: { id: true, username: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ messages });
});

// Edit own message.
router.patch('/:id', async (req, res) => {
  const msg = await prisma.message.findUnique({ where: { id: req.params.id } });
  if (!msg || msg.authorId !== req.user.id) return res.status(403).json({ error: 'Not your message' });
  const updated = await prisma.message.update({ where: { id: req.params.id }, data: { content: req.body.content, editedAt: new Date() } });
  res.json({ message: updated });
});

// Soft-delete own message.
router.delete('/:id', async (req, res) => {
  const msg = await prisma.message.findUnique({ where: { id: req.params.id } });
  if (!msg || msg.authorId !== req.user.id) return res.status(403).json({ error: 'Not your message' });
  await prisma.message.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), content: '[deleted]' } });
  res.json({ ok: true });
});

// Pin/unpin a message.
router.patch('/:id/pin', async (req, res) => {
  const updated = await prisma.message.update({ where: { id: req.params.id }, data: { pinned: !!req.body.pinned } });
  res.json({ message: updated });
});

// Toggle a reaction.
router.post('/:id/react', async (req, res) => {
  const { emoji } = req.body || {};
  if (!emoji) return res.status(400).json({ error: 'Emoji required' });
  const key = { messageId_userId_emoji: { messageId: req.params.id, userId: req.user.id, emoji } };
  const existing = await prisma.reaction.findUnique({ where: key });
  if (existing) {
    await prisma.reaction.delete({ where: key });
    return res.json({ removed: true });
  }
  const reaction = await prisma.reaction.create({ data: { messageId: req.params.id, userId: req.user.id, emoji } });
  res.json({ reaction });
});

module.exports = router;
