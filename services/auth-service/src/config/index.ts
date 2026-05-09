import { logger } from '../utils/logger';

export const config = {
  env:  process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),

  db: {
    databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/games',
    redisUrl:    process.env.REDIS_URL     || 'redis://localhost:6379',
  },

  jwt: {
    secret:             process.env.JWT_SECRET                || 'dev-secret-change-me',
    accessExpiresIn:    process.env.JWT_EXPIRES_IN            || '15m',
    refreshExpiresIn:   process.env.REFRESH_TOKEN_EXPIRES_IN  || '7d',
  },

  bcrypt: {
    saltRounds: 12,
  },
};

// Warn loudly at startup if a default secret is used in production
if (config.env === 'production' && config.jwt.secret === 'dev-secret-change-me') {
  logger.warn('JWT_SECRET is set to the default dev value — set a strong secret in production');
}
