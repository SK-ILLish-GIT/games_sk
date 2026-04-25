import { PrismaClient } from '@prisma/client';
import { redis, LB_KEY, LB_GLOBAL, LB_CACHE_TTL } from '../db';

const prisma = new PrismaClient();

export interface ScorePayload {
  userId: string;
  username: string;
  gameId: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * Submit a score:
 * 1. Persist to PostgreSQL
 * 2. Update Redis sorted sets (per-game + global) atomically
 * 3. The sorted set stores max score per user (ZADD NX won't help; use a Lua script for max-only)
 */
export async function submitScore(payload: ScorePayload) {
  const { userId, username, gameId, score, metadata } = payload;

  // Write to DB
  const entry = await prisma.score.create({
    data: { userId, username, gameId, score, metadata: metadata as any },
  });

  // Update Redis sorted sets — keep max score per user per game
  // Lua: only update if new score > existing score
  const luaScript = `
    local currentScore = redis.call('ZSCORE', KEYS[1], ARGV[1])
    if currentScore == false or tonumber(currentScore) < tonumber(ARGV[2]) then
      redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
      return 1
    end
    return 0
  `;
  const member = `${userId}:${username}`;

  await redis.eval(luaScript, 1, LB_KEY(gameId), member, score.toString());
  await redis.eval(luaScript, 1, LB_GLOBAL,      member, score.toString());

  return entry;
}

/**
 * Get top N entries for a game from Redis sorted set.
 * Falls back to PostgreSQL if Redis is cold.
 */
export async function getLeaderboard(gameId: string, limit = 100) {
  const key = gameId === 'global' ? LB_GLOBAL : LB_KEY(gameId);

  // Try Redis first
  const raw = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');
  if (raw.length > 0) {
    const entries = [];
    for (let i = 0; i < raw.length; i += 2) {
      const [userId, username] = raw[i].split(':');
      entries.push({
        rank: Math.floor(i / 2) + 1,
        userId,
        username,
        score: parseInt(raw[i + 1], 10),
      });
    }
    return entries;
  }

  // Cold cache: query DB and populate Redis
  const scores = await prisma.score.groupBy({
    by: ['userId', 'username'],
    where: gameId === 'global' ? {} : { gameId },
    _max: { score: true },
    orderBy: { _max: { score: 'desc' } },
    take: limit,
  });

  // Warm up Redis
  const pipeline = redis.pipeline();
  scores.forEach((s: any, idx: number) => {
    const member = `${s.userId}:${s.username}`;
    pipeline.zadd(key, s._max.score, member);
  });
  pipeline.expire(key, LB_CACHE_TTL * 10); // warm cache lasts 5 min
  await pipeline.exec();

  return scores.map((s: any, idx: number) => ({
    rank: idx + 1,
    userId: s.userId,
    username: s.username,
    score: s._max.score,
  }));
}

/**
 * Get a user's best score and rank for a specific game.
 */
export async function getUserRank(gameId: string, userId: string, username: string) {
  const key = gameId === 'global' ? LB_GLOBAL : LB_KEY(gameId);
  const member = `${userId}:${username}`;
  const [rank, score] = await Promise.all([
    redis.zrevrank(key, member),
    redis.zscore(key, member),
  ]);
  return {
    rank: rank !== null ? rank + 1 : null,
    score: score ? parseInt(score, 10) : null,
  };
}
