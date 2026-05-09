import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Router } from 'express';
import { connect, disconnect, redis } from './db';
import * as ctrl from './controllers/game.controller';

const app = express();
const PORT = parseInt(process.env.PORT || '3004', 10);

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());

const router = Router();
router.post('/games',             ctrl.createGame);
router.get('/games/:id',          ctrl.getGame);
router.post('/games/:id/guess',   ctrl.makeGuess);

app.use('/', router);

app.get('/health', async (_req, res) => {
  try {
    const pong = await redis.ping();
    res.json({ status: 'ok', service: 'guess-number-service', redis: pong === 'PONG' ? 'connected' : 'degraded', uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: String(err) });
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[guess-number]', err);
  res.status(err.status || 500).json({ success: false, error: err.message || 'Internal server error' });
});

async function start() {
  await connect();
  app.listen(PORT, '0.0.0.0', () => console.log(`[guess-number-service] Listening on port ${PORT}`));
}

process.on('SIGTERM', async () => { await disconnect(); process.exit(0); });
start();
