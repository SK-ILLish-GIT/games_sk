import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Router } from 'express';

import { config } from './config';
import { connect, disconnect, redis } from './db';
import { logger } from './utils/logger';
import * as ctrl from './controllers/game.controller';

const app = express();

// ── Middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────
const router = Router();
router.post('/games',           ctrl.createGame);
router.get('/games/:id',        ctrl.getGame);
router.post('/games/:id/move',  ctrl.makeMove);

app.use('/', router);

// ── Health Check ───────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    const pong = await redis.ping();
    res.json({ status: 'ok', service: 'tic-tac-toe-service', redis: pong === 'PONG' ? 'connected' : 'degraded', uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: String(err) });
  }
});

// ── Global Error Handler ───────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status || 500;
  if (status >= 500) {
    logger.error('Unhandled error', err);
  } else {
    logger.warn('Client error', { status, message: err.message });
  }
  res.status(status).json({ success: false, error: err.message || 'Internal server error' });
});

// ── Startup ────────────────────────────────────────────────────────
async function start() {
  try {
    await connect();
    app.listen(config.port, '0.0.0.0', () => logger.info(`Listening on port ${config.port}`, { service: 'tic-tac-toe-service', port: config.port }));
  } catch (err) {
    logger.error('Startup failed — exiting', err);
    process.exit(1);
  }
}

// Graceful shutdown: release DB connections before the container stops
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down gracefully', { service: 'tic-tac-toe-service' });
  await disconnect();
  process.exit(0);
});

start();
