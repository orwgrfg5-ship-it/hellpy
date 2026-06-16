const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const publicUser = { id: true, username: true, displayName: true, avatarUrl: true, presence: true };

// Mask presence for invisible users.
function maskPresence(user) {
  if (!user) return user;
  return user.invisible ? { ...user, presence: 'OFFLINE' } : user;
}

// Send a friend request by username.
router.post('/request', async (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username required' });
  const target = await prisma.user.findUnique({ where: { username } });
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot add yourself' });

  // If a friendship already exists in either direction, surface it.
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: req.user.id, addresseeId: target.id },
        { requesterId: target.id, addresseeId: req.user.id },
      ],
    },
  });
  if (existing) return res.status(409).json({ error: 'Friendship already exists', status: existing.status });

  const friendship = await prisma.friendship.create({
    data: { requesterId: req.user.id, addresseeId: target.id, status: 'PENDING' },
  });
  res.json({ friendship });
});

// Accept a pending request (only the addressee can accept).
router.post('/:id/accept', async (req, res) => {
  const fr = await prisma.friendship.findUnique({ where: { id: req.params.id } });
  if (!fr || fr.addresseeId !== req.user.id || fr.status !== 'PENDING') {
    return res.status(403).json({ error: 'Cannot accept this request' });
  }
  const friendship = await prisma.friendship.update({ where: { id: fr.id }, data: { status: 'ACCEPTED' } });
  res.json({ friendship });
});

// Decline a pending request or remove an existing friend (either party).
router.delete('/:id', async (req, res) => {
  const fr = await prisma.friendship.findUnique({ where: { id: req.params.id } });
  if (!fr || (fr.requesterId !== req.user.id && fr.addresseeId !== req.user.id)) {
    return res.status(403).json({ error: 'Not your friendship' });
  }
  await prisma.friendship.delete({ where: { id: fr.id } });
  res.json({ ok: true });
});

// List friends + pending requests for the current user.
router.get('/', async (req, res) => {
  const rows = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: req.user.id }, { addresseeId: req.user.id }] },
    include: {
      requester: { select: { ...publicUser, invisible: true } },
      addressee: { select: { ...publicUser, invisible: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const friends = [];
  const incoming = [];
  const outgoing = [];
  for (const r of rows) {
    const other = r.requesterId === req.user.id ? r.addressee : r.requester;
    const entry = { friendshipId: r.id, user: maskPresence(other), status: r.status };
    if (r.status === 'ACCEPTED') friends.push(entry);
    else if (r.status === 'PENDING' && r.addresseeId === req.user.id) incoming.push(entry);
    else if (r.status === 'PENDING') outgoing.push(entry);
  }
  res.json({ friends, incoming, outgoing });
});

module.exports = router;
