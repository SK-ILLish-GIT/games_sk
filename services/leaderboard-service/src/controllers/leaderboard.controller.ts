import { Request, Response, NextFunction } from 'express';
import * as lb from '../services/leaderboard.service';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// POST /scores — called by game services after a game finishes
export const submitScore = wrap(async (req, res) => {
  const { userId, username, gameId, score, metadata } = req.body;
  if (!userId || !username || !gameId || score === undefined) {
    res.status(400).json({ success: false, error: 'userId, username, gameId, score required' });
    return;
  }
  const entry = await lb.submitScore({ userId, username, gameId, score: Number(score), metadata });
  res.status(201).json({ success: true, data: entry });
});

// GET /leaderboard/:gameId?limit=50
export const getLeaderboard = wrap(async (req, res) => {
  const { gameId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);
  const entries = await lb.getLeaderboard(gameId, limit);
  res.json({ success: true, data: entries });
});

// GET /leaderboard/global?limit=50
export const getGlobalLeaderboard = wrap(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);
  const entries = await lb.getLeaderboard('global', limit);
  res.json({ success: true, data: entries });
});

// GET /leaderboard/:gameId/me  — requires JWT
export const getMyRank = wrap(async (req, res) => {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ success: false, error: 'Authentication required' }); return; }

  const payload = jwt.verify(token, JWT_SECRET) as any;
  const { gameId } = req.params;
  const result = await lb.getUserRank(gameId, payload.sub, payload.username);
  res.json({ success: true, data: result });
});
