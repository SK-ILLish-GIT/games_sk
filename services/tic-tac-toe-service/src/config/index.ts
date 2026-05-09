import { logger } from '../utils/logger';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3003', 10),
  db: {
    mongoUri: process.env.MONGO_URL || 'mongodb://localhost:27017/games',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  },
  services: {
    leaderboardUrl: process.env.LEADERBOARD_SERVICE_URL || 'http://leaderboard-service:3002',
  },
  game: {
    stateTtl: parseInt(process.env.GAME_STATE_TTL || '3600', 10), // Default 1 hour
  },
  http: {
    timeoutMs: parseInt(process.env.HTTP_TIMEOUT_MS || '3000', 10),
  }
};

// Warn loudly at startup if a default secret is used in production
if (config.env === 'production' && config.auth.jwtSecret === 'dev-secret-change-me') {
  logger.warn('JWT_SECRET is set to the default dev value — set a strong secret in production');
}
