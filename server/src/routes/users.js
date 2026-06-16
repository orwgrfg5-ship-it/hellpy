const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// Update own profile (display name, bio, banner, accent, avatar).
router.patch('/me/profile', async (req, res) => {
  const { displayName, bio, bannerUrl, accentColor, avatarUrl } = req.body || {};
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { displayName, bio, bannerUrl, accentColor, avatarUrl },
    select: { id: true, username: true, displayName: true, bio: true, bannerUrl: true, accentColor: true, avatarUrl: true },
  });
  res.json({ user });
});

// Update presence / invisible mode.
router.patch('/me/presence', async (req, res) => {
  const { presence, invisible } = req.body || {};
  const valid = ['ONLINE', 'AWAY', 'BUSY', 'OFFLINE'];
  const data = {};
  if (presence && valid.includes(presence)) data.presence = presence;
  if (typeof invisible === 'boolean') data.invisible = invisible;
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data,
    select: { id: true, presence: true, invisible: true },
  });
  res.json({ user });
});

// Public profile lookup (presence masked if invisible).
router.get('/:username', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { username: req.params.username },
    select: { id: true, username: true, displayName: true, bio: true, bannerUrl: true, accentColor: true, avatarUrl: true, presence: true, invisible: true },
  });
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.invisible) user.presence = 'OFFLINE';
  delete user.invisible;
  res.json({ user });
});

module.exports = router;
