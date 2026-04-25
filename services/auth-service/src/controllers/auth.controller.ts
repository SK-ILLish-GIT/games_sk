import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../db';
import {
  signAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
  verifyAccessToken,
} from '../services/token.service';
import bcrypt from 'bcryptjs';

function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

export const register = wrap(async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ success: false, error: 'username, email, password required' });
    return;
  }

  const exists = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
  if (exists) { res.status(409).json({ success: false, error: 'Username or email already taken' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, email, passwordHash, role: 'player' },
    select: { id: true, username: true, role: true },
  });

  const accessToken = signAccessToken({ sub: user.id, username: user.username, role: user.role });
  const refreshToken = await createRefreshToken(user.id);

  res.status(201).json({ success: true, data: { accessToken, refreshToken, user } });
});

export const login = wrap(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ success: false, error: 'username and password required' });
    return;
  }

  const user = await prisma.user.findFirst({ where: { OR: [{ username }, { email: username }] } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  const accessToken = signAccessToken({ sub: user.id, username: user.username, role: user.role });
  const refreshToken = await createRefreshToken(user.id);

  res.json({ success: true, data: { accessToken, refreshToken, user: { id: user.id, username: user.username, role: user.role } } });
});

export const refresh = wrap(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) { res.status(400).json({ success: false, error: 'refreshToken required' }); return; }

  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash: hash, revoked: false },
    include: { user: { select: { id: true, username: true, role: true } } },
  });

  if (!stored || stored.expiresAt < new Date()) {
    res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    return;
  }

  // Rotate
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
  const newRefreshToken = await createRefreshToken(stored.userId);
  const accessToken = signAccessToken({ sub: stored.user.id, username: stored.user.username, role: stored.user.role });

  res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
});

export const logout = wrap(async (req, res) => {
  const userId = (req as any).user?.sub;
  if (userId) await revokeAllUserTokens(userId);
  res.json({ success: true, data: { message: 'Logged out' } });
});

export const me = wrap(async (req, res) => {
  const userId = (req as any).user?.sub;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true, role: true, createdAt: true },
  });
  if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
  res.json({ success: true, data: user });
});

export const verify = wrap(async (req, res) => {
  // Used by other services to verify JWT without Redis/DB hop
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ success: false, error: 'No token' }); return; }

  try {
    const payload = verifyAccessToken(token);
    res.json({ success: true, data: payload });
  } catch {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});
