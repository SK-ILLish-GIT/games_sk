import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

import { config } from './config';
import { logger } from './utils/logger';

// Enable query logging only in development to avoid noisy production logs
export const prisma = new PrismaClient({
  log: config.env === 'development' ? ['query', 'error'] : ['error'],
});

export const redis = new Redis(config.db.redisUrl, {
  lazyConnect: true,
  // Exponential-like backoff capped at 3s to avoid hammering Redis on restarts
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

export async function connectDatabases() {
  await prisma.$connect();
  await redis.connect();
  logger.info('PostgreSQL + Redis connected');
}

export async function disconnectDatabases() {
  await prisma.$disconnect();
  await redis.quit();
  logger.info('PostgreSQL + Redis disconnected');
}
