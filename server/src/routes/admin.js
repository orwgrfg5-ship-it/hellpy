const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// Middleware: check if user is site owner
async function requireSiteOwner(req, res, next) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user?.isSiteOwner) {
    return res.status(403).json({ error: 'Only site owner can perform this action' });
  }
  next();
}

// Middleware: check if user is site owner or admin
async function requireSiteAdmin(req, res, next) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user?.isSiteOwner && !user?.isSiteAdmin) {
    return res.status(403).json({ error: 'Only site admins can perform this action' });
  }
  next();
}

// Get all users (site owner/admin only)
router.get('/users', requireSiteAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      isSiteOwner: true,
      isSiteAdmin: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ users });
});

// Promote user to site admin (site owner only)
router.post('/users/:userId/promote-admin', requireSiteOwner, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { isSiteAdmin: true },
      select: { id: true, username: true, isSiteAdmin: true },
    });
    res.json({ user });
  } catch (e) {
    res.status(400).json({ error: 'User not found' });
  }
});

// Demote admin to regular user (site owner only)
router.post('/users/:userId/demote-admin', requireSiteOwner, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { isSiteAdmin: false },
      select: { id: true, username: true, isSiteAdmin: true },
    });
    res.json({ user });
  } catch (e) {
    res.status(400).json({ error: 'User not found' });
  }
});

// Global ban (site admin/owner)
router.post('/users/:userId/ban', requireSiteAdmin, async (req, res) => {
  const { reason } = req.body || {};
  
  try {
    // Record the ban
    const action = await prisma.globalModerationAction.create({
      data: {
        type: 'BAN',
        actorId: req.user.id,
        targetId: req.params.userId,
        reason,
      },
    });
    
    res.json({ ok: true, action });
  } catch (e) {
    res.status(400).json({ error: 'Failed to ban user' });
  }
});

// Global timeout (site admin/owner)
router.post('/users/:userId/timeout', requireSiteAdmin, async (req, res) => {
  const { minutes, reason } = req.body || {};
  
  try {
    const until = new Date(Date.now() + (parseInt(minutes, 10) || 10) * 60 * 1000);
    
    // Record the timeout
    const action = await prisma.globalModerationAction.create({
      data: {
        type: 'TIMEOUT',
        actorId: req.user.id,
        targetId: req.params.userId,
        reason,
        expiresAt: until,
      },
    });
    
    res.json({ ok: true, action, until });
  } catch (e) {
    res.status(400).json({ error: 'Failed to timeout user' });
  }
});

// Get all global moderation actions
router.get('/moderation', requireSiteAdmin, async (req, res) => {
  const actions = await prisma.globalModerationAction.findMany({
    include: {
      actor: { select: { id: true, username: true } },
      target: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ actions });
});

// Check if current user is site admin/owner
router.get('/me/admin-status', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      isSiteOwner: true,
      isSiteAdmin: true,
    },
  });
  res.json(user || { isSiteOwner: false, isSiteAdmin: false });
});

module.exports = router;
