import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

import { gamesMetrics } from '@games-platform/observability';

import { config } from '../config';
import { HangmanSession, redis, gameKey, GAME_STATE_TTL } from '../db';
import { logger } from '../utils/logger';
import { HTTP_STATUS, ANONYMOUS_PLAYER, GUEST_PLAYER_NAME } from '../constants/game.constants';
import * as engine from '../game/engine';
import { HangmanStatus } from '../game/engine';

const GAME_LABEL = 'hangman';
import type {
  GameState,
  SafeGameState,
  JwtUserPayload,
  GuessRecord,
  DecoratedGuessRecord,
} from '../types';

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
  const doc = await HangmanSession.findOne({ gameId });
  if (!doc) return null;
  // Convert Mongoose document to plain GameState
  return {
    gameId:         doc.gameId,
    word:           doc.word,
    difficulty:     doc.difficulty,
    guessedLetters: doc.guessedLetters,
    wrongGuesses:   doc.wrongGuesses,
    maxWrong:       doc.maxWrong,
    guesses:        doc.guesses.map((g): GuessRecord => ({
      kind:      g.kind,
      value:     g.value,
      correct:   g.correct,
      timestamp: g.timestamp instanceof Date ? g.timestamp.toISOString() : (g.timestamp as string),
    })),
    status:         doc.status,
    playerId:       doc.playerId    ?? ANONYMOUS_PLAYER,
    playerName:     doc.playerName  ?? GUEST_PLAYER_NAME,
    createdAt:      doc.createdAt instanceof Date ? doc.createdAt.toISOString() : (doc.createdAt as string),
    finishedAt:     doc.finishedAt ? (doc.finishedAt instanceof Date ? doc.finishedAt.toISOString() : (doc.finishedAt as string)) : undefined,
  };
}

// Persists state to both Redis (TTL-based cache) and MongoDB (durable store)
async function saveState(state: GameState): Promise<void> {
  await redis.setex(gameKey(state.gameId), GAME_STATE_TTL, JSON.stringify(state));
  await HangmanSession.findOneAndUpdate({ gameId: state.gameId }, state, { upsert: true });
}

// Computes per-guess feedback against the secret word.
function decorateGuess(record: GuessRecord, word: string): DecoratedGuessRecord {
  if (record.kind === 'letter') {
    return { ...record, kind: 'letter', feedback: engine.letterFeedback(word, record.value) };
  }
  return { ...record, kind: 'word', feedback: engine.wordFeedback(word, record.value) };
}

// Strips the secret word for active games; reveals it once the game is finished.
// Always decorates each historical guess with feedback derived from the secret.
function toSafeState(state: GameState): SafeGameState {
  const maskedWord = engine.maskWord(state.word, state.guessedLetters);
  const decorated  = state.guesses.map((g) => decorateGuess(g, state.word));
  const { word, guesses: _guesses, ...rest } = state;
  return state.status === 'active'
    ? { ...rest, maskedWord, guesses: decorated }
    : { ...rest, maskedWord, guesses: decorated, word };
}

/**
 * Fire-and-forget score submission to the leaderboard service.
 * Failures are logged as warnings and do not affect the game response.
 */
async function submitScore(
  userId: string,
  username: string,
  score: number,
  meta: { difficulty: string; wrongGuesses: number; word: string },
): Promise<void> {
  try {
    await axios.post(`${config.services.leaderboardUrl}/scores`, {
      userId, username, gameId: config.game.id, score,
      metadata: meta,
    }, { timeout: config.game.httpTimeoutMs });
    logger.info('Score submitted to leaderboard', { userId, score, ...meta });
  } catch (err: unknown) {
    logger.warn('Failed to submit score — leaderboard may be unavailable', {
      userId,
      score,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// POST /games — creates a new hangman session
export const createGame = wrap(async (req: Request, res: Response) => {
  const user       = extractUser(req);
  const difficulty = engine.normaliseDifficulty((req.body as { difficulty?: unknown } | undefined)?.difficulty);
  const word       = engine.pickWord(difficulty);
  const gameId     = uuidv4();

  const state: GameState = {
    gameId,
    word,
    difficulty,
    guessedLetters: [],
    wrongGuesses:   0,
    maxWrong:       config.game.maxWrong,
    guesses:        [],
    status:         'active',
    playerId:       user?.id       ?? ANONYMOUS_PLAYER,
    playerName:     user?.username ?? GUEST_PLAYER_NAME,
    createdAt:      new Date().toISOString(),
  };

  await saveState(state);
  logger.info('New hangman game created', { gameId, difficulty, playerId: state.playerId, wordLength: word.length });
  gamesMetrics.gameStartedTotal.add(1, { game: GAME_LABEL, difficulty });

  res.status(HTTP_STATUS.CREATED).json({ success: true, data: toSafeState(state) });
});

// GET /games/:id — returns current game state without revealing the word while active
export const getGame = wrap(async (req: Request, res: Response) => {
  const gameId = req.params.id;
  const state  = await getState(gameId);
  if (!state) {
    logger.warn('Attempted to fetch non-existent game', { gameId });
    res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, error: 'Game not found' });
    return;
  }
  res.json({ success: true, data: toSafeState(state) });
});

// POST /games/:id/guess — processes a letter or full-word guess
//   body: { letter: string }  OR  { word: string }
export const makeGuess = wrap(async (req: Request, res: Response) => {
  const gameId = req.params.id;
  const state  = await getState(gameId);

  if (!state) {
    logger.warn('Guess on non-existent game', { gameId });
    res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, error: 'Game not found' });
    return;
  }
  if (state.status !== 'active') {
    logger.warn('Guess on finished game', { gameId, status: state.status });
    res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: 'Game already finished' });
    return;
  }

  const body = (req.body ?? {}) as { letter?: unknown; word?: unknown };
  if (body.letter === undefined && body.word === undefined) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: 'Either "letter" or "word" is required' });
    return;
  }
  if (body.letter !== undefined && body.word !== undefined) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: 'Provide either "letter" or "word", not both' });
    return;
  }

  let result: engine.GuessResult;
  let recordedGuess: GuessRecord;

  try {
    if (body.letter !== undefined) {
      const letter = engine.normaliseLetter(body.letter);
      const next = engine.applyLetterGuess(
        state.word,
        state.guessedLetters,
        state.wrongGuesses,
        state.maxWrong,
        letter,
      );

      if (next.result.alreadyTried) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: 'Letter already guessed' });
        return;
      }

      state.guessedLetters = next.guessedLetters;
      state.wrongGuesses   = next.wrongGuesses;
      result = next.result;
      recordedGuess = { kind: 'letter', value: letter, correct: next.result.correct, timestamp: new Date().toISOString() };
    } else {
      const guessedWord = engine.normaliseWord(body.word);
      if (guessedWord.length !== state.word.length) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error:   `Word must be ${state.word.length} letters`,
        });
        return;
      }
      const next = engine.applyWordGuess(state.word, state.wrongGuesses, state.maxWrong, guessedWord);

      // A correct guess wins immediately; a wrong guess costs one wrong attempt
      // and may end the game only if it crosses the maxWrong threshold.
      state.wrongGuesses = next.wrongGuesses;
      if (next.result.status === HangmanStatus.Won) {
        state.guessedLetters = Array.from(new Set([...state.guessedLetters, ...state.word.split('')]));
      }
      result = next.result;
      recordedGuess = { kind: 'word', value: guessedWord, correct: next.result.correct, timestamp: new Date().toISOString() };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid guess';
    logger.warn('Invalid guess payload', { gameId, error: message });
    res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: message });
    return;
  }

  state.guesses.push(recordedGuess);

  // Per-guess metric: lets us see letter-vs-word and correct-vs-wrong split.
  gamesMetrics.hangmanGuessesTotal.add(1, {
    kind:    recordedGuess.kind,
    correct: String(recordedGuess.correct),
    difficulty: state.difficulty,
  });

  if (result.status !== HangmanStatus.Active) {
    state.status     = result.status;
    state.finishedAt = new Date().toISOString();
    const won = result.status === HangmanStatus.Won;
    const score = engine.calculateScore(state.wrongGuesses, state.difficulty, won);

    logger.info('Game finished', {
      gameId,
      status: state.status,
      wrongGuesses: state.wrongGuesses,
      difficulty: state.difficulty,
      score,
    });

    // Domain metrics for the finished game.
    const outcome = won ? 'won' : 'lost';
    const durationSec = (Date.parse(state.finishedAt) - Date.parse(state.createdAt)) / 1000;
    gamesMetrics.gameFinishedTotal.add(1,   { game: GAME_LABEL, outcome, difficulty: state.difficulty });
    gamesMetrics.gameScore.record(score,    { game: GAME_LABEL, outcome, difficulty: state.difficulty });
    gamesMetrics.gameDurationSeconds.record(durationSec, { game: GAME_LABEL, outcome });

    // Submit score async — prefer the request's JWT, fall back to the stored playerId.
    // Losses still record a 0 in the leaderboard service so play history remains consistent.
    const user = extractUser(req);
    if (user) {
      void submitScore(user.id, user.username, score, {
        difficulty: state.difficulty, wrongGuesses: state.wrongGuesses, word: state.word,
      });
    } else if (state.playerId !== ANONYMOUS_PLAYER) {
      void submitScore(state.playerId, state.playerName, score, {
        difficulty: state.difficulty, wrongGuesses: state.wrongGuesses, word: state.word,
      });
    }
  }

  await saveState(state);
  const safe = toSafeState(state);
  res.json({
    success: true,
    data: {
      ...safe,
      lastGuess: decorateGuess(recordedGuess, state.word),
      attemptsLeft: Math.max(0, state.maxWrong - state.wrongGuesses),
    },
  });
});
