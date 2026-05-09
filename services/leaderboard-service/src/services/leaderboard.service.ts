import { redis, prisma, LB_KEY, LB_GLOBAL, LB_CACHE_TTL } from '../db';
import { logger } from '../utils/logger';

export interface ScorePayload {
  userId: string;
  username: string;
  gameId: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * Persists a score and updates two Redis sorted sets (per-game and global).
 * Uses a Lua script for an atomic max-score-only update: a score is only
 * written if it's higher than the user's current best.
 */
export async function submitScore(payload: ScorePayload) {
  const { userId, username, gameId, score, metadata } = payload;

  // Write to DB first as the source of truth
  const entry = await prisma.score.create({
    data: { userId, username, gameId, score, metadata: metadata as any },
  });

  // Lua: only update the sorted set if the new score beats the existing one
  const luaScript = `
    local currentScore = redis.call('ZSCORE', KEYS[1], ARGV[1])
    if currentScore == false or tonumber(currentScore) < tonumber(ARGV[2]) then
      redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
      return 1
    end
    return 0
  `;
  const member = `${userId}:${username}`;

  // Update both the per-game leaderboard and the cross-game global ranking
  await redis.eval(luaScript, 1, LB_KEY(gameId), member, score.toString());
  await redis.eval(luaScript, 1, LB_GLOBAL,      member, score.toString());

  return entry;
}

/**
 * Returns the top N entries for a game, sorted by score descending.
 * Serves from Redis sorted set when warm; falls back to PostgreSQL on a cold cache.
 */
export async function getLeaderboard(gameId: string, limit = 100) {
  const key = gameId === 'global' ? LB_GLOBAL : LB_KEY(gameId);

  // Attempt Redis first for low-latency reads
  const raw = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');
  if (raw.length > 0) {
    logger.debug('Leaderboard cache hit', { gameId, entries: raw.length / 2 });
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

  // Cold cache: query DB and warm Redis for subsequent requests
  logger.debug('Leaderboard cache miss — querying DB and warming cache', { gameId });
  const scores = await prisma.score.groupBy({
    by: ['userId', 'username'],
    where: gameId === 'global' ? {} : { gameId },
    _max: { score: true },
    orderBy: { _max: { score: 'desc' } },
    take: limit,
  });

  const pipeline = redis.pipeline();
  scores.forEach((s: any) => {
    const member = `${s.userId}:${s.username}`;
    pipeline.zadd(key, s._max.score, member);
  });
  // Warm cache lasts 5x the normal TTL since it's expensive to rebuild
  pipeline.expire(key, LB_CACHE_TTL * 10);
  await pipeline.exec();

  return scores.map((s: any, idx: number) => ({
    rank: idx + 1,
    userId: s.userId,
    username: s.username,
    score: s._max.score,
  }));
}

/**
 * Returns a single user's best score and rank for a specific game from Redis.
 * Rank is 1-indexed (null if the user has no score for this game).
 */
export async function getUserRank(gameId: string, userId: string, username: string) {
  const key    = gameId === 'global' ? LB_GLOBAL : LB_KEY(gameId);
  const member = `${userId}:${username}`;
  const [rank, score] = await Promise.all([
    redis.zrevrank(key, member),
    redis.zscore(key, member),
  ]);
  return {
    rank:  rank !== null ? rank + 1 : null, // Redis rank is 0-indexed
    score: score ? parseInt(score, 10) : null,
  };
}
