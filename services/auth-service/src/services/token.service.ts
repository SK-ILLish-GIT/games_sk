import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import { config } from '../config';
import { prisma, redis } from '../db';
import { logger } from '../utils/logger';
import type { JwtUserPayload } from '../types';

// Converts a duration string (e.g. "7d", "15m") to milliseconds
function msFromDuration(d: string): number {
  const units: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const match = d.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 86400000; // default to 7 days if format is unrecognised
  return parseInt(match[1]) * (units[match[2]] || 86400000);
}

export function signAccessToken(payload: { sub: string; username: string; role: string }): string {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.accessExpiresIn } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtUserPayload {
  return jwt.verify(token, config.jwt.secret) as JwtUserPayload;
}

export async function createRefreshToken(userId: string): Promise<string> {
  const raw = uuidv4();
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + msFromDuration(config.jwt.refreshExpiresIn));

  // Persist to DB as the source of truth
  await prisma.refreshToken.create({
    data: { tokenHash: hash, userId, expiresAt },
  });

  // Also cache in Redis for fast revocation checks; TTL mirrors DB expiry
  const ttlSeconds = Math.floor(msFromDuration(config.jwt.refreshExpiresIn) / 1000);
  await redis.setex(`refresh:${hash}`, ttlSeconds, userId);

  return raw; // Only the raw (unhashed) token is returned to the client
}

/**
 * Rotates a refresh token: validates the incoming token, revokes it,
 * and issues a fresh one. Returns null if the token is invalid or expired.
 */
export async function rotateRefreshToken(rawToken: string): Promise<string | null> {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Fast path: check Redis before hitting the DB
  const cachedUserId = await redis.get(`refresh:${hash}`);

  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash: hash, revoked: false },
  });

  if (!stored || stored.expiresAt < new Date()) {
    // Clean up stale Redis entry if DB says the token is gone/expired
    await redis.del(`refresh:${hash}`);
    logger.warn('Refresh token rotation failed — token invalid or expired', { userId: stored?.userId });
    return null;
  }

  // Revoke the consumed token before issuing the replacement
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
  await redis.del(`refresh:${hash}`);

  // Prefer the Redis-cached userId (faster); fall back to DB value
  return createRefreshToken(cachedUserId || stored.userId);
}

/**
 * Revokes all active refresh tokens for a user (e.g. on logout).
 * Clears Redis entries first, then bulk-updates DB to minimise the revocation window.
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  const tokens = await prisma.refreshToken.findMany({ where: { userId, revoked: false } });
  for (const t of tokens) {
    await redis.del(`refresh:${t.tokenHash}`);
  }
  await prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
  logger.info('All refresh tokens revoked', { userId, count: tokens.length });
}
