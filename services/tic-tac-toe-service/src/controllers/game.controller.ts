import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import * as engine from '../game/engine';
import { TicTacToeSession, redis, gameKey, GAME_STATE_TTL } from '../db';
import jwt from 'jsonwebtoken';

const LB_URL = process.env.LEADERBOARD_SERVICE_URL || 'http://leaderboard-service:3002';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function extractUser(req: Request): { id: string; username: string } | null {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const p = jwt.verify(token, JWT_SECRET) as any;
    return { id: p.sub, username: p.username };
  } catch { return null; }
}

async function getGameState(gameId: string) {
  // Redis first
  const cached = await redis.get(gameKey(gameId));
  if (cached) return JSON.parse(cached);
  // Fall back to MongoDB
  return TicTacToeSession.findOne({ gameId });
}

async function saveGameState(state: any) {
  await redis.setex(gameKey(state.gameId), GAME_STATE_TTL, JSON.stringify(state));
  await TicTacToeSession.findOneAndUpdate(
    { gameId: state.gameId },
    state,
    { upsert: true, new: true }
  );
}

async function submitScore(userId: string, username: string, score: number) {
  try {
    await axios.post(`${LB_URL}/scores`, {
      userId, username, gameId: 'tic-tac-toe', score,
    }, { timeout: 3000 });
  } catch (err) {
    console.error('[tic-tac-toe] Failed to submit score:', err);
    // Non-fatal: game still completes
  }
}

// POST /games
export const createGame = wrap(async (req, res) => {
  const user = extractUser(req);
  const gameId = uuidv4();
  const state = {
    gameId,
    board: Array(9).fill(null),
    currentPlayer: 'X' as engine.Player,
    status: 'active',
    winner: null,
    playerX: user?.id || 'anonymous',
    playerO: null,
    moves: [],
    createdAt: new Date().toISOString(),
  };
  await saveGameState(state);
  res.status(201).json({ success: true, data: state });
});

// GET /games/:id
export const getGame = wrap(async (req, res) => {
  const state = await getGameState(req.params.id);
  if (!state) { res.status(404).json({ success: false, error: 'Game not found' }); return; }
  res.json({ success: true, data: state });
});

// POST /games/:id/move
export const makeMove = wrap(async (req, res) => {
  const state = await getGameState(req.params.id);
  if (!state) { res.status(404).json({ success: false, error: 'Game not found' }); return; }
  if (state.status !== 'active') { res.status(400).json({ success: false, error: 'Game already finished' }); return; }

  const { position } = req.body;
  if (typeof position !== 'number') { res.status(400).json({ success: false, error: 'position (number 0-8) required' }); return; }

  let newBoard: engine.Board;
  let result: engine.GameResult;
  try {
    ({ board: newBoard, result } = engine.applyMove(state.board, position, state.currentPlayer));
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
    return;
  }

  state.board = newBoard;
  state.moves.push({ player: state.currentPlayer === 'X' ? (state.playerX || 'X') : (state.playerO || 'O'), position, symbol: state.currentPlayer, timestamp: new Date().toISOString() });

  if (result) {
    state.status = 'finished';
    state.winner = result === 'draw' ? 'draw' : result;
    state.finishedAt = new Date().toISOString();

    // Submit scores asynchronously
    const user = extractUser(req);
    if (user) {
      const score = engine.scoreForResult(result, state.currentPlayer);
      submitScore(user.id, user.username, score);
    }
  } else {
    state.currentPlayer = engine.nextPlayer(state.currentPlayer);
  }

  await saveGameState(state);
  res.json({ success: true, data: state });
});
