import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes';
import { connectDatabases, disconnectDatabases, prisma, redis } from './db';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

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

// ── Error handler ──────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status || 500;
  const message = status < 500 ? err.message : 'Internal server error';
  console.error('[auth-service]', err);
  res.status(status).json({ success: false, error: message, code: err.code });
});

// ── Start ──────────────────────────────────────────────────────────
async function start() {
  try {
    await connectDatabases();

    // Run migrations on startup
    const { execSync } = await import('child_process');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });

    app.listen(PORT, () => {
      console.log(`[auth-service] Listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('[auth-service] Startup failed:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  await disconnectDatabases();
  process.exit(0);
});

start();
