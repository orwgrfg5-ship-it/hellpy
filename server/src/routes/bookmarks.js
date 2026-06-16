const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// Toggle a bookmark on a message.
router.post('/:messageId', async (req, res) => {
  const key = { userId_messageId: { userId: req.user.id, messageId: req.params.messageId } };
  const existing = await prisma.bookmark.findUnique({ where: key });
  if (existing) {
    await prisma.bookmark.delete({ where: key });
    return res.json({ bookmarked: false });
  }
  await prisma.bookmark.create({ data: { userId: req.user.id, messageId: req.params.messageId } });
  res.json({ bookmarked: true });
});

// List the current user's bookmarked messages (most recent first).
router.get('/', async (req, res) => {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const ids = bookmarks.map((b) => b.messageId);
  const messages = await prisma.message.findMany({
    where: { id: { in: ids } },
    include: { author: { select: { id: true, username: true, displayName: true } } },
  });
  // Preserve bookmark order.
  const byId = Object.fromEntries(messages.map((m) => [m.id, m]));
  res.json({ messages: ids.map((id) => byId[id]).filter(Boolean) });
});

module.exports = router;
