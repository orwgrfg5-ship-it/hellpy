const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// Schedule a message for future delivery.
router.post('/', async (req, res) => {
  const { content, channelId, conversationId, sendAt } = req.body || {};
  if (!content || (!channelId && !conversationId)) return res.status(400).json({ error: 'content and a target required' });
  const when = new Date(sendAt);
  if (isNaN(when.getTime()) || when.getTime() <= Date.now()) return res.status(400).json({ error: 'sendAt must be a future time' });
  const scheduled = await prisma.scheduledMessage.create({
    data: { authorId: req.user.id, content, channelId: channelId || null, conversationId: conversationId || null, sendAt: when },
  });
  res.json({ scheduled });
});

// List the current user's pending scheduled messages.
router.get('/', async (req, res) => {
  const scheduled = await prisma.scheduledMessage.findMany({
    where: { authorId: req.user.id, sentAt: null },
    orderBy: { sendAt: 'asc' },
  });
  res.json({ scheduled });
});

// Cancel a pending scheduled message.
router.delete('/:id', async (req, res) => {
  const sm = await prisma.scheduledMessage.findUnique({ where: { id: req.params.id } });
  if (!sm || sm.authorId !== req.user.id) return res.status(403).json({ error: 'Not yours' });
  if (sm.sentAt) return res.status(400).json({ error: 'Already sent' });
  await prisma.scheduledMessage.delete({ where: { id: sm.id } });
  res.json({ ok: true });
});

module.exports = router;
