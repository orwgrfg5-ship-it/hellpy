const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const prisma = require('../prisma');
const { signToken, requireAuth } = require('../auth');

const router = express.Router();

async function createSessionToken(user, req) {
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return signToken({ id: user.id, username: user.username, sessionId: session.id });
}

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().max(64).optional(),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { username, email, password, displayName } = parsed.data;
  const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
  if (existing) return res.status(409).json({ error: 'Username or email already in use' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { username, email, passwordHash, displayName } });
  const token = await createSessionToken(user, req);
  res.json({ token, user: { id: user.id, username: user.username, displayName: user.displayName } });
});

router.post('/login', async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) return res.status(400).json({ error: 'Missing credentials' });
  const user = await prisma.user.findFirst({ where: { OR: [{ username: identifier }, { email: identifier }] } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  // Enforce 2FA when enabled: require a valid TOTP code OR a single-use recovery code.
  if (user.twoFactorEnabled) {
    const { totp } = req.body || {};
    if (!totp) return res.status(401).json({ error: '2FA required', twoFactorRequired: true });
    let valid = authenticator.verify({ token: String(totp), secret: user.totpSecret });
    if (!valid && user.recoveryCodes) {
      // Try recovery codes; consume the one that matches.
      const hashes = JSON.parse(user.recoveryCodes);
      for (let i = 0; i < hashes.length; i++) {
        if (await bcrypt.compare(String(totp), hashes[i])) {
          valid = true;
          hashes.splice(i, 1); // single-use
          await prisma.user.update({ where: { id: user.id }, data: { recoveryCodes: JSON.stringify(hashes) } });
          break;
        }
      }
    }
    if (!valid) return res.status(401).json({ error: 'Invalid 2FA code', twoFactorRequired: true });
  }

  const token = await createSessionToken(user, req);
  res.json({ token, user: { id: user.id, username: user.username, displayName: user.displayName } });
});

// Begin 2FA setup: generate a secret + QR (not yet enabled until verified).
router.post('/2fa/setup', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (user.twoFactorEnabled) return res.status(400).json({ error: 'Already enabled' });
  const secret = authenticator.generateSecret();
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });
  const otpauth = authenticator.keyuri(user.username, 'Helppy', secret);
  const qr = await QRCode.toDataURL(otpauth);
  res.json({ secret, qr });
});

// Verify a code and turn 2FA on. Returns one-time recovery codes (shown once).
router.post('/2fa/enable', requireAuth, async (req, res) => {
  const { totp } = req.body || {};
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user.totpSecret) return res.status(400).json({ error: 'Run setup first' });
  if (!authenticator.verify({ token: String(totp || ''), secret: user.totpSecret })) {
    return res.status(400).json({ error: 'Invalid code' });
  }
  // Generate 10 recovery codes; store only their hashes.
  const plain = Array.from({ length: 10 }, () => require('crypto').randomBytes(5).toString('hex'));
  const hashes = await Promise.all(plain.map((c) => bcrypt.hash(c, 10)));
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true, recoveryCodes: JSON.stringify(hashes) } });
  res.json({ ok: true, recoveryCodes: plain });
});

// Disable 2FA (requires a current code).
router.post('/2fa/disable', requireAuth, async (req, res) => {
  const { totp } = req.body || {};
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user.twoFactorEnabled) return res.status(400).json({ error: 'Not enabled' });
  if (!authenticator.verify({ token: String(totp || ''), secret: user.totpSecret })) {
    return res.status(400).json({ error: 'Invalid code' });
  }
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, totpSecret: null, recoveryCodes: null } });
  res.json({ ok: true });
});

router.post('/logout', requireAuth, async (req, res) => {
  if (req.user.sessionId) {
    await prisma.session.deleteMany({ where: { id: req.user.sessionId } });
  }
  res.json({ ok: true });
});

// List active sessions/devices for the current user.
router.get('/sessions', requireAuth, async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: { userId: req.user.id },
    select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ sessions });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, username: true, email: true, displayName: true, avatarUrl: true, bio: true, bannerUrl: true, accentColor: true, twoFactorEnabled: true },
  });
  res.json({ user });
});

module.exports = router;
