import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';

import { config } from '../config';
import { logger } from '../utils/logger';
import * as lb from '../services/leaderboard.service';

// Forwards async errors to the global error handler
function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// Extracts and verifies the Bearer JWT; returns the decoded payload or null on failure
function verifyToken(req: Request): jwt.JwtPayload | null {
  const auth  = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;
  } catch {
    return null;
  }
}

// POST /scores — called internally by game services after a game finishes
export const submitScore = wrap(async (req, res) => {
  const { userId, username, gameId, score, metadata } = req.body;
  if (!userId || !username || !gameId || score === undefined) {
    res.status(400).json({ success: false, error: 'userId, username, gameId, score required' });
    return;
  }

  const entry = await lb.submitScore({ userId, username, gameId, score: Number(score), metadata });
  logger.info('Score submitted', { userId, username, gameId, score: Number(score) });
  res.status(201).json({ success: true, data: entry });
});

// GET /leaderboard/:gameId?limit=50
export const getLeaderboard = wrap(async (req, res) => {
  const { gameId } = req.params;
  // Cap limit at maxLimit to prevent accidentally large DB/Redis reads
  const limit = Math.min(
    parseInt(req.query.limit as string || String(config.leaderboard.defaultLimit), 10),
    config.leaderboard.maxLimit,
  );
  const entries = await lb.getLeaderboard(gameId, limit);
  res.json({ success: true, data: entries });
});

// GET /leaderboard/global?limit=50
export const getGlobalLeaderboard = wrap(async (req, res) => {
  const limit = Math.min(
    parseInt(req.query.limit as string || String(config.leaderboard.defaultLimit), 10),
    config.leaderboard.maxLimit,
  );
  const entries = await lb.getLeaderboard('global', limit);
  res.json({ success: true, data: entries });
});

// GET /leaderboard/:gameId/me — requires a valid JWT
export const getMyRank = wrap(async (req, res) => {
  const payload = verifyToken(req);
  if (!payload) {
    // Return 401 whether the token is missing or invalid — do not reveal which
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const { gameId } = req.params;
  const result = await lb.getUserRank(gameId, payload.sub as string, payload.username);
  res.json({ success: true, data: result });
});
