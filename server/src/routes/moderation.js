const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../auth');
const { canModerate } = require('../permissions');

const router = express.Router();
router.use(requireAuth);

async function getMembers(serverId, actorId, targetId) {
  const [actor, target] = await Promise.all([
    prisma.serverMember.findUnique({ where: { serverId_userId: { serverId, userId: actorId } } }),
    prisma.serverMember.findUnique({ where: { serverId_userId: { serverId, userId: targetId } } }),
  ]);
  return { actor, target };
}

async function record(serverId, type, actorId, targetId, reason, expiresAt) {
  return prisma.moderationAction.create({ data: { serverId, type, actorId, targetId, reason, expiresAt } });
}

// Kick: remove a member from the server.
router.post('/:serverId/kick', async (req, res) => {
  const { targetId, reason } = req.body || {};
  const { actor, target } = await getMembers(req.params.serverId, req.user.id, targetId);
  if (!actor || !target || !canModerate(actor.role, target.role)) return res.status(403).json({ error: 'Insufficient permission' });
  await prisma.serverMember.delete({ where: { id: target.id } });
  await record(req.params.serverId, 'KICK', req.user.id, targetId, reason);
  res.json({ ok: true });
});

// Ban: remove member and record a ban.
router.post('/:serverId/ban', async (req, res) => {
  const { targetId, reason } = req.body || {};
  const { actor, target } = await getMembers(req.params.serverId, req.user.id, targetId);
  if (!actor || !target || !canModerate(actor.role, target.role)) return res.status(403).json({ error: 'Insufficient permission' });
  await prisma.serverMember.delete({ where: { id: target.id } });
  await record(req.params.serverId, 'BAN', req.user.id, targetId, reason);
  res.json({ ok: true });
});

// Timeout: temporarily block participation until a timestamp.
router.post('/:serverId/timeout', async (req, res) => {
  const { targetId, minutes, reason } = req.body || {};
  const { actor, target } = await getMembers(req.params.serverId, req.user.id, targetId);
  if (!actor || !target || !canModerate(actor.role, target.role)) return res.status(403).json({ error: 'Insufficient permission' });
  const until = new Date(Date.now() + (parseInt(minutes, 10) || 10) * 60 * 1000);
  await prisma.serverMember.update({ where: { id: target.id }, data: { timeoutUntil: until } });
  await record(req.params.serverId, 'TIMEOUT', req.user.id, targetId, reason, until);
  res.json({ ok: true, until });
});

// Mute: block sending messages until a timestamp.
router.post('/:serverId/mute', async (req, res) => {
  const { targetId, minutes, reason } = req.body || {};
  const { actor, target } = await getMembers(req.params.serverId, req.user.id, targetId);
  if (!actor || !target || !canModerate(actor.role, target.role)) return res.status(403).json({ error: 'Insufficient permission' });
  const until = new Date(Date.now() + (parseInt(minutes, 10) || 10) * 60 * 1000);
  await prisma.serverMember.update({ where: { id: target.id }, data: { mutedUntil: until } });
  await record(req.params.serverId, 'MUTE', req.user.id, targetId, reason, until);
  res.json({ ok: true, until });
});

module.exports = router;
