import crypto from 'crypto';

import bcrypt from 'bcryptjs';
import { NextFunction, Request, Response } from 'express';

import { config } from '../config';
import { prisma } from '../db';
import { logger } from '../utils/logger';
import {
  createRefreshToken,
  revokeAllUserTokens,
  signAccessToken,
  verifyAccessToken,
} from '../services/token.service';
import type { AuthenticatedRequest, HttpError } from '../types';

// Forwards async errors to the global error handler, avoiding boilerplate try-catch in every handler
function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => { fn(req, res, next).catch(next); };
}

export const register = wrap(async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ success: false, error: 'username, email, password required' });
    return;
  }

  const exists = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
  if (exists) {
    logger.warn('Registration rejected — username or email already taken', { username });
    res.status(409).json({ success: false, error: 'Username or email already taken' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, config.bcrypt.saltRounds);
  const user = await prisma.user.create({
    data: { username, email, passwordHash, role: 'player' },
    select: { id: true, username: true, role: true },
  });

  const accessToken  = signAccessToken({ sub: user.id, username: user.username, role: user.role });
  const refreshToken = await createRefreshToken(user.id);

  logger.info('User registered', { userId: user.id, username: user.username });
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
    // Log at warn (not error) — invalid credentials are expected traffic, not a server fault
    logger.warn('Failed login attempt', { username });
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  const accessToken  = signAccessToken({ sub: user.id, username: user.username, role: user.role });
  const refreshToken = await createRefreshToken(user.id);

  logger.info('User logged in', { userId: user.id, username: user.username });
  res.json({ success: true, data: { accessToken, refreshToken, user: { id: user.id, username: user.username, role: user.role } } });
});

export const refresh = wrap(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) { res.status(400).json({ success: false, error: 'refreshToken required' }); return; }

  const hash   = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash: hash, revoked: false },
    include: { user: { select: { id: true, username: true, role: true } } },
  });

  if (!stored || stored.expiresAt < new Date()) {
    logger.warn('Token refresh rejected — invalid or expired token', { userId: stored?.userId });
    res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    return;
  }

  // Rotate: revoke the old token and issue a fresh one (prevents token reuse attacks)
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
  const newRefreshToken = await createRefreshToken(stored.userId);
  const accessToken     = signAccessToken({ sub: stored.user.id, username: stored.user.username, role: stored.user.role });

  logger.info('Token refreshed', { userId: stored.userId });
  res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
});

export const logout = wrap(async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user?.sub;
  if (userId) {
    await revokeAllUserTokens(userId);
    logger.info('User logged out — all tokens revoked', { userId });
  }
  res.json({ success: true, data: { message: 'Logged out' } });
});

export const me = wrap(async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user?.sub;
  const user   = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, username: true, email: true, role: true, createdAt: true },
  });
  if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
  res.json({ success: true, data: user });
});

// Used by downstream services to validate a JWT without a DB round-trip
export const verify = wrap(async (req, res) => {
  const auth  = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ success: false, error: 'No token' }); return; }

  try {
    const payload = verifyAccessToken(token);
    res.json({ success: true, data: payload });
  } catch {
    // Not logged — this is an expected client error, not a server fault
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});
