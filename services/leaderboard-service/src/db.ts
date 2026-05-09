import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

import { config } from './config';
import { logger } from './utils/logger';

export const prisma = new PrismaClient({ log: ['error'] });

export const redis = new Redis(config.db.redisUrl, {
  lazyConnect: true,
  // Exponential-like backoff capped at 3s to avoid hammering Redis on restarts
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

// Redis sorted-set key helpers
export const LB_KEY    = (gameId: string) => `leaderboard:${gameId}`;
export const LB_GLOBAL = 'leaderboard:global';
// Cache TTL is now sourced from config (LB_CACHE_TTL env var, default 30s)
export const LB_CACHE_TTL = config.leaderboard.cacheTtl;

export async function connect() {
  await prisma.$connect();
  await redis.connect();
  logger.info('PostgreSQL + Redis connected');
}

export async function disconnect() {
  await prisma.$disconnect();
  redis.quit();
  logger.info('PostgreSQL + Redis disconnected');
}
