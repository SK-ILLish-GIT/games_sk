import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

import { gamesMetrics } from '@games-platform/observability';

import { config } from '../config';
import { TicTacToeSession, redis, gameKey, GAME_STATE_TTL } from '../db';
import { logger } from '../utils/logger';
import { GAME_CONSTANTS, HTTP_STATUS, ANONYMOUS_PLAYER } from '../config/constants';
import * as engine from '../game/engine';
import { Player, GameResult } from '../game/engine';
import type { TicTacToeState, JwtUserPayload } from '../types';

const GAME_LABEL = 'tic-tac-toe';

/**
 * Wraps async Express route handlers to automatically catch and forward errors
 * to the global error handling middleware, eliminating the need for repetitive try-catch blocks.
 */
function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => { fn(req, res, next).catch(next); };
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
    const p = jwt.verify(token, config.auth.jwtSecret) as JwtUserPayload;
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
async function getGameState(gameId: string): Promise<TicTacToeState | null> {
  const cached = await redis.get(gameKey(gameId));
  if (cached) {
    logger.debug('Game state cache hit', { gameId });
    return JSON.parse(cached) as TicTacToeState;
  }

  logger.debug('Game state cache miss, fetching from DB', { gameId });
  const doc = await TicTacToeSession.findOne({ gameId });
  if (!doc) return null;

  // Convert Mongoose document to plain TicTacToeState
  return {
    gameId:        doc.gameId,
    board:         doc.board,
    currentPlayer: doc.currentPlayer as Player,
    status:        doc.status,
    winner:        doc.winner as GameResult,
    playerX:       doc.playerX ?? ANONYMOUS_PLAYER,
    playerO:       doc.playerO ?? null,
    moves:         doc.moves.map((m) => ({
      player:    m.player,
      position:  m.position,
      symbol:    m.symbol as Player,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : (m.timestamp as string),
    })),
    createdAt:     doc.createdAt instanceof Date ? doc.createdAt.toISOString() : (doc.createdAt as string),
    finishedAt:    doc.finishedAt ? (doc.finishedAt instanceof Date ? doc.finishedAt.toISOString() : (doc.finishedAt as string)) : undefined,
  };
}

/**
 * Saves the game state to both MongoDB (persistent) and Redis (fast access).
 */
async function saveGameState(state: TicTacToeState): Promise<void> {
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
async function submitScore(userId: string, username: string, score: number): Promise<void> {
  try {
    logger.info('Submitting score to leaderboard', { userId, score });
    await axios.post(`${config.services.leaderboardUrl}/scores`, {
      userId, username, gameId: GAME_CONSTANTS.GAME_ID, score,
    }, { timeout: config.http.timeoutMs });
  } catch (err: unknown) {
    // We only log a warning because leaderboard failures shouldn't crash the game flow
    logger.warn('Failed to submit score, leaderboard might be down', {
      userId,
      gameId: GAME_CONSTANTS.GAME_ID,
      score,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// POST /games
export const createGame = wrap(async (req: Request, res: Response) => {
  const user   = extractUser(req);
  const gameId = uuidv4();

  const state: TicTacToeState = {
    gameId,
    board:         Array(GAME_CONSTANTS.BOARD_SIZE).fill(null) as (string | null)[],
    currentPlayer: Player.X,
    status:        'active',
    winner:        null,
    playerX:       user?.id ?? ANONYMOUS_PLAYER,
    playerO:       null, // A second player can join later or play locally
    moves:         [],
    createdAt:     new Date().toISOString(),
  };

  await saveGameState(state);
  logger.info('New game session created', { gameId, playerX: state.playerX });
  gamesMetrics.gameStartedTotal.add(1, { game: GAME_LABEL, difficulty: 'default' });

  res.status(HTTP_STATUS.CREATED).json({ success: true, data: state });
});

// GET /games/:id
export const getGame = wrap(async (req: Request, res: Response) => {
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
export const makeMove = wrap(async (req: Request, res: Response) => {
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

  const { position } = req.body as { position?: unknown };
  if (typeof position !== 'number') {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: 'position (number 0-8) required' });
    return;
  }

  let newBoard: engine.Board;
  let result: engine.GameResult | null;

  try {
    ({ board: newBoard, result } = engine.applyMove(state.board, position, state.currentPlayer));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid move';
    logger.warn('Invalid move payload/logic', { gameId, position, error: message });
    res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: message });
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
    state.winner     = result === GameResult.Draw ? GameResult.Draw : result;
    state.finishedAt = new Date().toISOString();

    logger.info('Game finished', { gameId, winner: state.winner, totalMoves: state.moves.length });

    const outcome = result === GameResult.Draw ? 'draw' : 'won';
    const durationSec = (Date.parse(state.finishedAt) - Date.parse(state.createdAt)) / 1000;
    const score = engine.scoreForResult(result, state.currentPlayer);
    gamesMetrics.gameFinishedTotal.add(1, { game: GAME_LABEL, outcome, difficulty: 'default' });
    gamesMetrics.gameScore.record(score, { game: GAME_LABEL, outcome, difficulty: 'default' });
    gamesMetrics.gameDurationSeconds.record(durationSec, { game: GAME_LABEL, outcome });

    // Submit scores asynchronously if it's a registered user
    const user = extractUser(req);
    if (user) {
      void submitScore(user.id, user.username, score); // fire-and-forget
    }
  } else {
    // Pass turn to the next player
    state.currentPlayer = engine.nextPlayer(state.currentPlayer);
  }

  await saveGameState(state);
  res.json({ success: true, data: state });
});
