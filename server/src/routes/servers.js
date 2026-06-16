const express = require('express');
const crypto = require('crypto');
const prisma = require('../prisma');
const { requireAuth } = require('../auth');
const { canModerate, isAdmin } = require('../permissions');

const router = express.Router();
router.use(requireAuth);

async function membership(serverId, userId) {
  return prisma.serverMember.findUnique({ where: { serverId_userId: { serverId, userId } } });
}

// Create a server (creator becomes OWNER) with a default #general channel.
router.post('/', async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  const server = await prisma.server.create({
    data: {
      name,
      ownerId: req.user.id,
      members: { create: { userId: req.user.id, role: 'OWNER' } },
      channels: { create: { name: 'general' } },
    },
    include: { channels: true },
  });
  res.json({ server });
});

// List servers the user is a member of.
router.get('/', async (req, res) => {
  const servers = await prisma.server.findMany({
    where: { members: { some: { userId: req.user.id } } },
    include: { channels: true },
  });
  res.json({ servers });
});

// Create a channel (admins+ only). Optionally place it in a category.
router.post('/:serverId/channels', async (req, res) => {
  const m = await membership(req.params.serverId, req.user.id);
  if (!m || !isAdmin(m.role)) return res.status(403).json({ error: 'Admin required' });
  const { name, topic, categoryId } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  const channel = await prisma.channel.create({ data: { serverId: req.params.serverId, name, topic, categoryId: categoryId || null } });
  res.json({ channel });
});

// Create a category (admins+).
router.post('/:serverId/categories', async (req, res) => {
  const m = await membership(req.params.serverId, req.user.id);
  if (!m || !isAdmin(m.role)) return res.status(403).json({ error: 'Admin required' });
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  const category = await prisma.category.create({ data: { serverId: req.params.serverId, name } });
  res.json({ category });
});

// List categories (with their channels) for a server.
router.get('/:serverId/categories', async (req, res) => {
  const m = await membership(req.params.serverId, req.user.id);
  if (!m) return res.status(403).json({ error: 'Not a member' });
  const categories = await prisma.category.findMany({
    where: { serverId: req.params.serverId },
    include: { channels: true },
    orderBy: { position: 'asc' },
  });
  res.json({ categories });
});

// Move a channel into (or out of) a category (admins+).
router.patch('/:serverId/channels/:channelId/category', async (req, res) => {
  const m = await membership(req.params.serverId, req.user.id);
  if (!m || !isAdmin(m.role)) return res.status(403).json({ error: 'Admin required' });
  const channel = await prisma.channel.update({
    where: { id: req.params.channelId },
    data: { categoryId: req.body.categoryId || null },
  });
  res.json({ channel });
});

// Moderation audit log (mods+ can view).
router.get('/:serverId/audit-log', async (req, res) => {
  const m = await membership(req.params.serverId, req.user.id);
  if (!m || canModerate(m.role, 'MEMBER') === false) return res.status(403).json({ error: 'Moderator required' });
  const actions = await prisma.moderationAction.findMany({
    where: { serverId: req.params.serverId },
    include: {
      actor: { select: { id: true, username: true, displayName: true } },
      target: { select: { id: true, username: true, displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ actions });
});

// Set channel slowmode (mods+).
router.patch('/:serverId/channels/:channelId/slowmode', async (req, res) => {
  const m = await membership(req.params.serverId, req.user.id);
  if (!m || canModerate(m.role, 'MEMBER') === false) return res.status(403).json({ error: 'Moderator required' });
  const seconds = Math.max(0, parseInt(req.body.seconds, 10) || 0);
  const channel = await prisma.channel.update({ where: { id: req.params.channelId }, data: { slowmode: seconds } });
  res.json({ channel });
});

// Create an invite (members can invite).
router.post('/:serverId/invites', async (req, res) => {
  const m = await membership(req.params.serverId, req.user.id);
  if (!m) return res.status(403).json({ error: 'Not a member' });
  const code = crypto.randomBytes(4).toString('hex');
  const invite = await prisma.invite.create({ data: { code, serverId: req.params.serverId } });
  res.json({ invite });
});

// List members of a server with their roles (any member can view).
router.get('/:serverId/members', async (req, res) => {
  const m = await membership(req.params.serverId, req.user.id);
  if (!m) return res.status(403).json({ error: 'Not a member' });
  const members = await prisma.serverMember.findMany({
    where: { serverId: req.params.serverId },
    include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, presence: true, invisible: true } } },
    orderBy: { role: 'asc' },
  });
  // Mask presence for invisible users.
  const masked = members.map((mem) => ({
    ...mem,
    user: mem.user.invisible ? { ...mem.user, presence: 'OFFLINE' } : mem.user,
  }));
  res.json({ members: masked, me: { role: m.role } });
});

// Change a member's role (admins+; cannot set or outrank OWNER, cannot exceed own rank).
router.patch('/:serverId/members/:userId/role', async (req, res) => {
  const me = await membership(req.params.serverId, req.user.id);
  const target = await membership(req.params.serverId, req.params.userId);
  if (!me || !isAdmin(me.role)) return res.status(403).json({ error: 'Admin required' });
  if (!target) return res.status(404).json({ error: 'Member not found' });
  const { role } = req.body || {};
  const allowed = ['ADMIN', 'MODERATOR', 'MEMBER'];
  if (!allowed.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (target.role === 'OWNER') return res.status(403).json({ error: 'Cannot change the owner' });
  if (!canModerate(me.role, target.role)) return res.status(403).json({ error: 'Cannot manage this member' });
  const updated = await prisma.serverMember.update({ where: { id: target.id }, data: { role } });
  res.json({ member: updated });
});

// Delete a channel (admins+).
router.delete('/:serverId/channels/:channelId', async (req, res) => {
  const m = await membership(req.params.serverId, req.user.id);
  if (!m || !isAdmin(m.role)) return res.status(403).json({ error: 'Admin required' });
  await prisma.channel.delete({ where: { id: req.params.channelId } });
  res.json({ ok: true });
});

// Leave a server (owner cannot leave; must transfer or delete).
router.post('/:serverId/leave', async (req, res) => {
  const m = await membership(req.params.serverId, req.user.id);
  if (!m) return res.status(404).json({ error: 'Not a member' });
  if (m.role === 'OWNER') return res.status(400).json({ error: 'Owner cannot leave; transfer ownership first' });
  await prisma.serverMember.delete({ where: { id: m.id } });
  res.json({ ok: true });
});

// Join a server by invite code.
router.post('/join/:code', async (req, res) => {
  const invite = await prisma.invite.findUnique({ where: { code: req.params.code } });
  if (!invite) return res.status(404).json({ error: 'Invalid invite' });
  const existing = await membership(invite.serverId, req.user.id);
  if (existing) return res.json({ serverId: invite.serverId });
  await prisma.serverMember.create({ data: { serverId: invite.serverId, userId: req.user.id, role: 'MEMBER' } });
  res.json({ serverId: invite.serverId });
});

module.exports = router;
