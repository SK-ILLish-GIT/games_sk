import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes';
import { connectDatabases, disconnectDatabases, prisma, redis } from './db';
import fs from 'fs';
import path from 'path';

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

    // Prefer running migrations when the repo has migration files. For dev/local
    // environments where there are no migrations (schema already present in DB),
    // use `prisma db push` to avoid P3005 errors when the DB schema is non-empty.
    const { execSync } = await import('child_process');
    const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
    const hasMigrations = fs.existsSync(migrationsDir) && fs.readdirSync(migrationsDir).length > 0;

    if (hasMigrations) {
      try {
        execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      } catch (err: any) {
        const msg = String(err && err.message ? err.message : err);
        console.error('[auth-service] prisma migrate deploy failed:', msg);
        if (msg.includes('P3005')) {
          console.warn('[auth-service] Detected P3005; falling back to `prisma db push`.');
          try {
            execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
          } catch (err2: any) {
            console.error('[auth-service] prisma db push also failed:', String(err2 && err2.message ? err2.message : err2));
            throw err2;
          }
        } else {
          throw err;
        }
      }
    } else {
      console.log('[auth-service] No migrations found; using `prisma db push` to sync schema.');
      try {
        execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
      } catch (err: any) {
        console.error('[auth-service] prisma db push failed:', String(err && err.message ? err.message : err));
        throw err;
      }
    }

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
