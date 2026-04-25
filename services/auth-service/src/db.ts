import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

export async function connectDatabases() {
  await prisma.$connect();
  await redis.connect();
  console.log('[auth-service] PostgreSQL + Redis connected');
}

export async function disconnectDatabases() {
  await prisma.$disconnect();
  await redis.quit();
}
