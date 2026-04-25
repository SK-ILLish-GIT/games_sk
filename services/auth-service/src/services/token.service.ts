import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { prisma, redis } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

function msFromDuration(d: string): number {
  const units: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const match = d.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 86400000;
  return parseInt(match[1]) * (units[match[2]] || 86400000);
}

export function signAccessToken(payload: { sub: string; username: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
}

export async function createRefreshToken(userId: string): Promise<string> {
  const raw = uuidv4();
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + msFromDuration(REFRESH_EXPIRES_IN));

  await prisma.refreshToken.create({
    data: { tokenHash: hash, userId, expiresAt },
  });

  // Cache in Redis with TTL
  const ttlSeconds = Math.floor(msFromDuration(REFRESH_EXPIRES_IN) / 1000);
  await redis.setex(`refresh:${hash}`, ttlSeconds, userId);

  return raw;
}

export async function rotateRefreshToken(rawToken: string): Promise<string | null> {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Fast path: check Redis first
  const cachedUserId = await redis.get(`refresh:${hash}`);

  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash: hash, revoked: false },
  });

  if (!stored || stored.expiresAt < new Date()) {
    await redis.del(`refresh:${hash}`);
    return null;
  }

  // Revoke old token
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
  await redis.del(`refresh:${hash}`);

  return createRefreshToken(cachedUserId || stored.userId);
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  const tokens = await prisma.refreshToken.findMany({ where: { userId, revoked: false } });
  for (const t of tokens) {
    await redis.del(`refresh:${t.tokenHash}`);
  }
  await prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
}
