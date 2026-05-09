import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

import { config } from '../config';
import { GuessSession, redis, gameKey, GAME_STATE_TTL } from '../db';
import { logger } from '../utils/logger';
import * as engine from '../game/engine';
import type { GameState, JwtUserPayload } from '../types';

// Forwards async errors to the global error handler, avoiding boilerplate try-catch
function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => { fn(req, res, next).catch(next); };
}

// Extracts user identity from the JWT; returns null for anonymous or invalid tokens
function extractUser(req: Request): { id: string; username: string } | null {
  const auth  = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const p = jwt.verify(token, config.jwt.secret) as JwtUserPayload;
    return { id: p.sub, username: p.username };
  } catch {
    return null; // Silently ignore bad tokens to allow unauthenticated play
  }
}

// Retrieves game state from Redis (fast) or MongoDB (fallback on cache miss)
async function getState(gameId: string): Promise<GameState | null> {
  const cached = await redis.get(gameKey(gameId));
  if (cached) {
    logger.debug('Game state cache hit', { gameId });
    return JSON.parse(cached) as GameState;
  }
  logger.debug('Game state cache miss, fetching from DB', { gameId });
  const doc = await GuessSession.findOne({ gameId });
  if (!doc) return null;
  // Convert Mongoose document to plain GameState
  return {
    gameId:      doc.gameId,
    secret:      doc.secret,
    attempts:    doc.attempts,
    maxAttempts: doc.maxAttempts,
    guesses:     doc.guesses.map((g) => ({ value: g.value, hint: g.hint, timestamp: g.timestamp instanceof Date ? g.timestamp.toISOString() : (g.timestamp as string) })),
    status:      doc.status,
    playerId:    doc.playerId ?? 'anonymous',
    playerName:  doc.playerName ?? 'Guest',
    createdAt:   doc.createdAt instanceof Date ? doc.createdAt.toISOString() : (doc.createdAt as string),
    finishedAt:  doc.finishedAt ? (doc.finishedAt instanceof Date ? doc.finishedAt.toISOString() : (doc.finishedAt as string)) : undefined,
  };
}

// Persists state to both Redis (TTL-based cache) and MongoDB (durable store)
async function saveState(state: GameState): Promise<void> {
  await redis.setex(gameKey(state.gameId), GAME_STATE_TTL, JSON.stringify(state));
  await GuessSession.findOneAndUpdate({ gameId: state.gameId }, state, { upsert: true });
}

/**
 * Fire-and-forget score submission to the leaderboard service.
 * Failures are logged as warnings and do not affect the game response.
 */
async function submitScore(userId: string, username: string, score: number, attempts: number): Promise<void> {
  try {
    await axios.post(`${config.services.leaderboardUrl}/scores`, {
      userId, username, gameId: config.game.id, score,
      metadata: { attempts },
    }, { timeout: config.game.httpTimeoutMs });
    logger.info('Score submitted to leaderboard', { userId, score, attempts });
  } catch (err: unknown) {
    logger.warn('Failed to submit score — leaderboard may be unavailable', {
      userId,
      score,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// POST /games — creates a new guess-number session
export const createGame = wrap(async (req: Request, res: Response) => {
  const user   = extractUser(req);
  const gameId = uuidv4();
  const state: GameState = {
    gameId,
    secret:      engine.generateSecret(), // secret is never sent to the client
    attempts:    0,
    maxAttempts: config.game.maxAttempts,
    guesses:     [],
    status:      'active',
    playerId:    user?.id       ?? 'anonymous',
    playerName:  user?.username ?? 'Guest',
    createdAt:   new Date().toISOString(),
  };

  await saveState(state);
  logger.info('New game created', { gameId, playerId: state.playerId });

  // Strip secret from response — clients must never see the answer
  const { secret: _secret, ...safe } = state;
  res.status(201).json({ success: true, data: safe });
});

// GET /games/:id — returns current game state without revealing the secret
export const getGame = wrap(async (req: Request, res: Response) => {
  const gameId = req.params.id;
  const state  = await getState(gameId);
  if (!state) {
    logger.warn('Attempted to fetch non-existent game', { gameId });
    res.status(404).json({ success: false, error: 'Game not found' });
    return;
  }
  const { secret: _secret, ...safe } = state;
  res.json({ success: true, data: safe });
});

// POST /games/:id/guess — processes a player's guess
export const makeGuess = wrap(async (req: Request, res: Response) => {
  const gameId = req.params.id;
  const state  = await getState(gameId);

  if (!state) {
    logger.warn('Guess on non-existent game', { gameId });
    res.status(404).json({ success: false, error: 'Game not found' });
    return;
  }
  if (state.status !== 'active') {
    logger.warn('Guess on finished game', { gameId, status: state.status });
    res.status(400).json({ success: false, error: 'Game already finished' });
    return;
  }

  const { guess } = req.body as { guess?: unknown };
  if (typeof guess !== 'number' || guess < config.game.minGuess || guess > config.game.maxGuess) {
    res.status(400).json({ success: false, error: `guess must be a number between ${config.game.minGuess} and ${config.game.maxGuess}` });
    return;
  }

  const hint = engine.evaluateGuess(state.secret, guess);
  state.attempts += 1;
  state.guesses.push({ value: guess, hint, timestamp: new Date().toISOString() });

  const won  = hint === 'correct';
  const lost = !won && state.attempts >= state.maxAttempts;

  if (won || lost) {
    state.status     = won ? 'won' : 'lost';
    state.finishedAt = new Date().toISOString();
    const score      = engine.calculateScore(state.attempts, won);

    logger.info('Game finished', { gameId, status: state.status, attempts: state.attempts, score });

    // Submit score async — prefer the request's JWT, fall back to the stored playerId
    const user = extractUser(req);
    if (user) {
      void submitScore(user.id, user.username, score, state.attempts);
    } else if (state.playerId !== 'anonymous') {
      void submitScore(state.playerId, state.playerName, score, state.attempts);
    }
  }

  await saveState(state);
  const { secret: _secret, ...safe } = state;
  res.json({ success: true, data: { ...safe, hint, attemptsLeft: state.maxAttempts - state.attempts } });
});
