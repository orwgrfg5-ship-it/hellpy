const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// Shape a poll with vote counts and the caller's selections.
async function serialize(pollId, userId) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { options: { include: { votes: true } } },
  });
  if (!poll) return null;
  return {
    id: poll.id,
    question: poll.question,
    multiple: poll.multiple,
    closesAt: poll.closesAt,
    options: poll.options.map((o) => ({
      id: o.id,
      text: o.text,
      count: o.votes.length,
      votedByMe: o.votes.some((v) => v.userId === userId),
    })),
    totalVotes: poll.options.reduce((n, o) => n + o.votes.length, 0),
  };
}

// Create a poll (2-10 options).
router.post('/', async (req, res) => {
  const { question, options, channelId, conversationId, multiple } = req.body || {};
  if (!question || !Array.isArray(options) || options.length < 2 || options.length > 10) {
    return res.status(400).json({ error: 'A question and 2-10 options are required' });
  }
  if (!channelId && !conversationId) return res.status(400).json({ error: 'A target is required' });
  const poll = await prisma.poll.create({
    data: {
      authorId: req.user.id,
      question,
      channelId: channelId || null,
      conversationId: conversationId || null,
      multiple: !!multiple,
      options: { create: options.map((text) => ({ text: String(text).slice(0, 200) })) },
    },
  });
  res.json({ poll: await serialize(poll.id, req.user.id) });
});

// Get poll results.
router.get('/:id', async (req, res) => {
  const poll = await serialize(req.params.id, req.user.id);
  if (!poll) return res.status(404).json({ error: 'Not found' });
  res.json({ poll });
});

// Vote for an option. For single-choice polls, replaces any prior vote in the same poll.
router.post('/:id/vote', async (req, res) => {
  const { optionId } = req.body || {};
  const poll = await prisma.poll.findUnique({ where: { id: req.params.id }, include: { options: true } });
  if (!poll) return res.status(404).json({ error: 'Not found' });
  if (poll.closesAt && new Date(poll.closesAt) < new Date()) return res.status(400).json({ error: 'Poll closed' });
  const option = poll.options.find((o) => o.id === optionId);
  if (!option) return res.status(400).json({ error: 'Invalid option' });

  const optionIds = poll.options.map((o) => o.id);
  const existingMine = await prisma.pollVote.findFirst({ where: { userId: req.user.id, optionId: { in: optionIds } } });

  if (!poll.multiple) {
    // Single choice: clear prior votes in this poll, then set the new one.
    await prisma.pollVote.deleteMany({ where: { userId: req.user.id, optionId: { in: optionIds } } });
    await prisma.pollVote.create({ data: { optionId, userId: req.user.id } });
  } else {
    // Multiple choice: toggle this option.
    const mine = await prisma.pollVote.findUnique({ where: { optionId_userId: { optionId, userId: req.user.id } } });
    if (mine) await prisma.pollVote.delete({ where: { id: mine.id } });
    else await prisma.pollVote.create({ data: { optionId, userId: req.user.id } });
  }
  res.json({ poll: await serialize(poll.id, req.user.id) });
});

module.exports = router;
