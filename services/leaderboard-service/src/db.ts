import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

export const prisma = new PrismaClient({ log: ['error'] });
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

// Redis key helpers
export const LB_KEY = (gameId: string) => `leaderboard:${gameId}`;
export const LB_GLOBAL = 'leaderboard:global';
export const LB_CACHE_TTL = 30; // seconds

export async function connect() {
  await prisma.$connect();
  await redis.connect();
  console.log('[leaderboard-service] PostgreSQL + Redis connected');
}

export async function disconnect() {
  await prisma.$disconnect();
  redis.quit();
}
