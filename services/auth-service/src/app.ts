import fs from 'fs';
import path from 'path';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { config } from './config';
import { connectDatabases, disconnectDatabases, prisma, redis } from './db';
import { logger } from './utils/logger';
import authRoutes from './routes/auth.routes';
import type { HttpError } from './types';

const app = express();

// ── Middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '100kb' }));

// ── Routes ─────────────────────────────────────────────────────────
app.use('/', authRoutes);

// ── Health Check ───────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const redisPing = await redis.ping();
    res.json({
      status: 'ok',
      service: 'auth-service',
      db: 'connected',
      redis: redisPing === 'PONG' ? 'connected' : 'degraded',
      uptime: process.uptime(),
    });
  } catch (err) {
    res.status(503).json({ status: 'degraded', service: 'auth-service', error: String(err) });
  }
});

// ── Global Error Handler ───────────────────────────────────────────
// Catches errors forwarded by the `wrap` helper in controllers.
// 4xx errors are client mistakes; only 5xx are true server failures.
app.use((err: HttpError, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status ?? 500;
  const message = status < 500 ? err.message : 'Internal server error';
  if (status >= 500) {
    logger.error('Unhandled server error', err);
  } else {
    logger.warn('Client error', { status, message: err.message, code: err.code });
  }
  res.status(status).json({ success: false, error: message, code: err.code });
});

// ── Startup ────────────────────────────────────────────────────────
async function start() {
  try {
    await connectDatabases();

    // Prefer running migrations when the repo has migration files. For dev/local
    // environments where there are no migrations (schema already present in DB),
    // use `prisma db push` to avoid P3005 errors when the DB schema is non-empty.
    const { execSync } = await import('child_process');
    const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
    const hasMigrations = fs.existsSync(migrationsDir) && fs.readdirSync(migrationsDir).length > 0;

    if (hasMigrations) {
      logger.info('Running prisma migrate deploy');
      try {
        execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('prisma migrate deploy failed', err);
        if (msg.includes('P3005')) {
          // P3005 means the DB is non-empty but has no migration history; fall back to push
          logger.warn('Detected P3005 — falling back to prisma db push');
          try {
            execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
          } catch (err2: unknown) {
            logger.error('prisma db push also failed', err2);
            throw err2;
          }
        } else {
          throw err;
        }
      }
    } else {
      logger.info('No migrations found — using prisma db push to sync schema');
      try {
        execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
      } catch (err: unknown) {
        logger.error('prisma db push failed', err);
        throw err;
      }
    }

    app.listen(config.port, '0.0.0.0', () => {
      logger.info(`Listening on port ${config.port}`, { port: config.port });
    });
  } catch (err) {
    logger.error('Startup failed — exiting', err);
    process.exit(1);
  }
}

// Graceful shutdown: release DB connections before the container stops
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down gracefully');
  await disconnectDatabases();
  process.exit(0);
});

start();
