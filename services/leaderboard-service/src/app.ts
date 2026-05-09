import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { config } from './config';
import { connect, disconnect, prisma, redis } from './db';
import { logger } from './utils/logger';
import lbRoutes from './routes/leaderboard.routes';
import type { HttpError } from './types';

const app = express();

// ── Middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '100kb' }));

// ── Routes ─────────────────────────────────────────────────────────
app.use('/', lbRoutes);

// ── Health Check ───────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const pong = await redis.ping();
    res.json({ status: 'ok', service: 'leaderboard-service', db: 'connected', redis: pong === 'PONG' ? 'connected' : 'degraded', uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', service: 'leaderboard-service', error: String(err) });
  }
});

// ── Global Error Handler ───────────────────────────────────────────
app.use((err: HttpError, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status ?? 500;
  if (status >= 500) {
    logger.error('Unhandled server error', err);
  } else {
    logger.warn('Client error', { status, message: err.message });
  }
  res.status(status).json({ success: false, error: err.message || 'Internal server error' });
});

// ── Startup ────────────────────────────────────────────────────────
async function start() {
  try {
    await connect();

    // Deploy any pending Prisma migrations on startup (safe to run on every boot)
    const { execSync } = await import('child_process');
    logger.info('Running prisma migrate deploy');
    try {
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    } catch (err) {
      // Non-fatal: migrations may already be up-to-date or managed by auth-service
      logger.warn('prisma migrate deploy had a non-zero exit — migrations may already be applied');
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
  await disconnect();
  process.exit(0);
});

start();
