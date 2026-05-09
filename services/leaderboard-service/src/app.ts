import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import lbRoutes from './routes/leaderboard.routes';
import { connect, disconnect, prisma, redis } from './db';

const app = express();
const PORT = parseInt(process.env.PORT || '3002', 10);

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '100kb' }));

app.use('/', lbRoutes);

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const pong = await redis.ping();
    res.json({ status: 'ok', service: 'leaderboard-service', db: 'connected', redis: pong === 'PONG' ? 'connected' : 'degraded', uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', service: 'leaderboard-service', error: String(err) });
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[leaderboard-service]', err);
  res.status(err.status || 500).json({ success: false, error: err.message || 'Internal server error' });
});

async function start() {
  await connect();

  // Run DB migrations using shared auth-service schema (same PG instance)
  const { execSync } = await import('child_process');
  try { execSync('npx prisma migrate deploy', { stdio: 'inherit' }); } catch { /* migrations may already be up */ }

  app.listen(PORT, '0.0.0.0', () => console.log(`[leaderboard-service] Listening on port ${PORT}`));
}

process.on('SIGTERM', async () => { await disconnect(); process.exit(0); });
start();
