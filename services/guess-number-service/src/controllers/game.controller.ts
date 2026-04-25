import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import * as engine from '../game/engine';
import { GuessSession, redis, gameKey, GAME_STATE_TTL } from '../db';

const LB_URL = process.env.LEADERBOARD_SERVICE_URL || 'http://leaderboard-service:3002';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function extractUser(req: Request): { id: string; username: string } | null {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try { const p = jwt.verify(token, JWT_SECRET) as any; return { id: p.sub, username: p.username }; }
  catch { return null; }
}

async function getState(gameId: string) {
  const cached = await redis.get(gameKey(gameId));
  if (cached) return JSON.parse(cached);
  return GuessSession.findOne({ gameId });
}

async function saveState(state: any) {
  await redis.setex(gameKey(state.gameId), GAME_STATE_TTL, JSON.stringify(state));
  await GuessSession.findOneAndUpdate({ gameId: state.gameId }, state, { upsert: true });
}

async function submitScore(userId: string, username: string, score: number, attempts: number) {
  try {
    await axios.post(`${LB_URL}/scores`, {
      userId, username, gameId: 'guess-number', score,
      metadata: { attempts },
    }, { timeout: 3000 });
  } catch (err) { console.error('[guess-number] Score submit failed:', err); }
}

// POST /games
export const createGame = wrap(async (req, res) => {
  const user = extractUser(req);
  const gameId = uuidv4();
  const state = {
    gameId,
    secret: engine.generateSecret(),
    attempts: 0,
    maxAttempts: 7,
    guesses: [],
    status: 'active',
    playerId: user?.id || 'anonymous',
    playerName: user?.username || 'Guest',
    createdAt: new Date().toISOString(),
  };
  await saveState(state);
  // Return state WITHOUT secret
  const { secret, ...safe } = state;
  res.status(201).json({ success: true, data: safe });
});

// GET /games/:id
export const getGame = wrap(async (req, res) => {
  const state = await getState(req.params.id);
  if (!state) { res.status(404).json({ success: false, error: 'Game not found' }); return; }
  const { secret, ...safe } = state;
  res.json({ success: true, data: safe });
});

// POST /games/:id/guess
export const makeGuess = wrap(async (req, res) => {
  const state = await getState(req.params.id);
  if (!state) { res.status(404).json({ success: false, error: 'Game not found' }); return; }
  if (state.status !== 'active') { res.status(400).json({ success: false, error: 'Game already finished' }); return; }

  const { guess } = req.body;
  if (typeof guess !== 'number' || guess < 1 || guess > 100) {
    res.status(400).json({ success: false, error: 'guess must be a number between 1 and 100' });
    return;
  }

  const hint = engine.evaluateGuess(state.secret, guess);
  state.attempts += 1;
  state.guesses.push({ value: guess, hint, timestamp: new Date().toISOString() });

  const won = hint === 'correct';
  const lost = !won && state.attempts >= state.maxAttempts;

  if (won || lost) {
    state.status = won ? 'won' : 'lost';
    state.finishedAt = new Date().toISOString();
    const score = engine.calculateScore(state.attempts, won);

    const user = extractUser(req);
    if (user) submitScore(user.id, user.username, score, state.attempts);
    else if (state.playerId !== 'anonymous') submitScore(state.playerId, state.playerName, score, state.attempts);
  }

  await saveState(state);
  const { secret, ...safe } = state;
  res.json({ success: true, data: { ...safe, hint, attemptsLeft: state.maxAttempts - state.attempts } });
});
