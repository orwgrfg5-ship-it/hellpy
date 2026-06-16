const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// Ensure the current user is a member of the conversation. Returns the member or null.
async function requireMember(conversationId, userId) {
  return prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
}

// Start or fetch a direct conversation, or create a group conversation.
router.post('/', async (req, res) => {
  const { userIds, name } = req.body || {};
  if (!Array.isArray(userIds) || userIds.length === 0) return res.status(400).json({ error: 'userIds required' });
  const participants = Array.from(new Set([req.user.id, ...userIds]));
  const type = participants.length > 2 ? 'GROUP' : 'DIRECT';

  // For DMs, reuse an existing direct conversation with the same two participants.
  if (type === 'DIRECT') {
    const existing = await prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        AND: participants.map((userId) => ({ members: { some: { userId } } })),
      },
      include: { members: true },
    });
    if (existing && existing.members.length === participants.length) {
      return res.json({ conversation: existing });
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      type,
      name: type === 'GROUP' ? name || 'Group chat' : null,
      members: { create: participants.map((userId) => ({ userId })) },
    },
    include: { members: true },
  });
  res.json({ conversation });
});

// List the current user's conversations.
router.get('/', async (req, res) => {
  const conversations = await prisma.conversation.findMany({
    where: { members: { some: { userId: req.user.id } } },
    include: { members: { include: { user: { select: { id: true, username: true, displayName: true } } } } },
  });
  res.json({ conversations });
});

// Fetch messages in a conversation (top-level only) with reply counts.
// Pagination: pass ?before=<messageId> to load older messages.
router.get('/:id/messages', async (req, res) => {
  if (!(await requireMember(req.params.id, req.user.id))) return res.status(403).json({ error: 'Forbidden' });
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const before = req.query.before ? await prisma.message.findUnique({ where: { id: req.query.before.toString() } }) : null;
  const messages = await prisma.message.findMany({
    where: {
      conversationId: req.params.id,
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
  res.json({ messages: messages.reverse(), hasMore: messages.length === limit });
});

// Mark conversation read up to a message (read receipts).
router.post('/:id/read', async (req, res) => {
  if (!(await requireMember(req.params.id, req.user.id))) return res.status(403).json({ error: 'Forbidden' });
  await prisma.conversationMember.updateMany({
    where: { conversationId: req.params.id, userId: req.user.id },
    data: { lastReadMessageId: req.body.messageId || null },
  });
  res.json({ ok: true });
});

// List pinned messages in a conversation.
router.get('/:id/pins', async (req, res) => {
  if (!(await requireMember(req.params.id, req.user.id))) return res.status(403).json({ error: 'Forbidden' });
  const messages = await prisma.message.findMany({
    where: { conversationId: req.params.id, pinned: true, deletedAt: null },
    include: { author: { select: { id: true, username: true, displayName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ messages });
});

// Read receipts: where each other member has read up to.
router.get('/:id/receipts', async (req, res) => {
  if (!(await requireMember(req.params.id, req.user.id))) return res.status(403).json({ error: 'Forbidden' });
  const members = await prisma.conversationMember.findMany({
    where: { conversationId: req.params.id },
    select: { userId: true, lastReadMessageId: true, user: { select: { username: true, displayName: true } } },
  });
  res.json({ receipts: members });
});

module.exports = router;
