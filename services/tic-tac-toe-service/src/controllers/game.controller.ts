import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

import { config } from '../config';
import { TicTacToeSession, redis, gameKey, GAME_STATE_TTL } from '../db';
import { logger } from '../utils/logger';
import { GAME_CONSTANTS, HTTP_STATUS } from '../config/constants';
import * as engine from '../game/engine';

/**
 * Wraps async Express route handlers to automatically catch and forward errors
 * to the global error handling middleware, eliminating the need for repetitive try-catch blocks.
 */
function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

/**
 * Safely extracts user information from the JWT Authorization header.
 * If the token is missing, invalid, or expired, it returns null to allow for anonymous gameplay.
 */
function extractUser(req: Request): { id: string; username: string } | null {
  const auth  = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  try {
    const p = jwt.verify(token, config.auth.jwtSecret) as any;
    return { id: p.sub, username: p.username };
  } catch {
    // Silently fail on bad tokens to allow unauthenticated access to continue
    return null;
  }
}

/**
 * Retrieves the current game state, preferring the fast Redis cache
 * and falling back to MongoDB if the cache has expired or was evicted.
 */
async function getGameState(gameId: string) {
  const cached = await redis.get(gameKey(gameId));
  if (cached) {
    logger.debug('Game state cache hit', { gameId });
    return JSON.parse(cached);
  }

  logger.debug('Game state cache miss, fetching from DB', { gameId });
  return TicTacToeSession.findOne({ gameId });
}

/**
 * Saves the game state to both MongoDB (persistent) and Redis (fast access).
 */
async function saveGameState(state: any) {
  await redis.setex(gameKey(state.gameId), GAME_STATE_TTL, JSON.stringify(state));
  await TicTacToeSession.findOneAndUpdate(
    { gameId: state.gameId },
    state,
    { upsert: true, new: true }
  );
}

/**
 * Asynchronously fires a request to the leaderboard service to register a completed game's score.
 * Failures are logged as warnings and do not affect the game response.
 */
async function submitScore(userId: string, username: string, score: number) {
  try {
    logger.info('Submitting score to leaderboard', { userId, score });
    await axios.post(`${config.services.leaderboardUrl}/scores`, {
      userId, username, gameId: GAME_CONSTANTS.GAME_ID, score,
    }, { timeout: config.http.timeoutMs });
  } catch (err) {
    // We only log a warning because leaderboard failures shouldn't crash the game flow
    logger.warn('Failed to submit score, leaderboard might be down', { userId, gameId: GAME_CONSTANTS.GAME_ID, score, error: err instanceof Error ? err.message : String(err) });
  }
}

// POST /games
export const createGame = wrap(async (req, res) => {
  const user   = extractUser(req);
  const gameId = uuidv4();

  const state = {
    gameId,
    board:         Array(GAME_CONSTANTS.BOARD_SIZE).fill(null),
    currentPlayer: 'X' as engine.Player,
    status:        'active',
    winner:        null,
    playerX:       user?.id || 'anonymous',
    playerO:       null, // A second player can join later or play locally
    moves:         [],
    createdAt:     new Date().toISOString(),
  };

  await saveGameState(state);
  logger.info('New game session created', { gameId, playerX: state.playerX });

  res.status(HTTP_STATUS.CREATED).json({ success: true, data: state });
});

// GET /games/:id
export const getGame = wrap(async (req, res) => {
  const gameId = req.params.id;
  const state  = await getGameState(gameId);

  if (!state) {
    logger.warn('Attempted to fetch non-existent game', { gameId });
    res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, error: 'Game not found' });
    return;
  }

  res.json({ success: true, data: state });
});

// POST /games/:id/move
export const makeMove = wrap(async (req, res) => {
  const gameId = req.params.id;
  const state  = await getGameState(gameId);

  if (!state) {
    logger.warn('Move attempted on non-existent game', { gameId });
    res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, error: 'Game not found' });
    return;
  }

  if (state.status !== 'active') {
    logger.warn('Move attempted on finished game', { gameId, status: state.status });
    res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: 'Game already finished' });
    return;
  }

  const { position } = req.body;
  if (typeof position !== 'number') {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: 'position (number 0-8) required' });
    return;
  }

  let newBoard: engine.Board;
  let result: engine.GameResult;

  try {
    ({ board: newBoard, result } = engine.applyMove(state.board, position, state.currentPlayer));
  } catch (err: any) {
    logger.warn('Invalid move payload/logic', { gameId, position, error: err.message });
    res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: err.message });
    return;
  }

  // Update state with valid move
  state.board = newBoard;
  state.moves.push({
    player:    state.currentPlayer === 'X' ? (state.playerX || 'X') : (state.playerO || 'O'),
    position,
    symbol:    state.currentPlayer,
    timestamp: new Date().toISOString(),
  });

  if (result) {
    // Game over condition met
    state.status     = 'finished';
    state.winner     = result === 'draw' ? 'draw' : result;
    state.finishedAt = new Date().toISOString();

    logger.info('Game finished', { gameId, winner: state.winner, totalMoves: state.moves.length });

    // Submit scores asynchronously if it's a registered user
    const user = extractUser(req);
    if (user) {
      const score = engine.scoreForResult(result, state.currentPlayer);
      submitScore(user.id, user.username, score); // Note: we don't await this so the response is fast
    }
  } else {
    // Pass turn to the next player
    state.currentPlayer = engine.nextPlayer(state.currentPlayer);
  }

  await saveGameState(state);
  res.json({ success: true, data: state });
});
