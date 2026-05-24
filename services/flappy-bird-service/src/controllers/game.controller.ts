import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

import { gamesMetrics } from '@games-platform/observability';

import { config } from '../config';
import {
  FlappySession,
  FlappyProfile,
  redis,
  gameKey,
  dailySeedKey,
  GAME_STATE_TTL,
  DAILY_SEED_TTL,
} from '../db';
import { logger } from '../utils/logger';
import {
  HTTP_STATUS,
  ANONYMOUS_PLAYER,
  GUEST_PLAYER_NAME,
} from '../constants/game.constants';
import * as engine from '../game/engine';
import type {
  CreateGameBody,
  FinishGameBody,
  JwtUserPayload,
} from '../types';

const GAME_LABEL = 'flappy-bird';

// ── Helpers ────────────────────────────────────────────────────────

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
    return null;
  }
}

// Fire-and-forget score submission to the leaderboard service.
async function submitScore(
  userId: string,
  username: string,
  score: number,
  meta: { mode: string; distance: number; jumps: number; durationMs: number },
): Promise<void> {
  try {
    await axios.post(
      `${config.services.leaderboardUrl}/scores`,
      {
        userId,
        username,
        gameId: config.game.id,
        score,
        metadata: meta,
      },
      { timeout: config.game.httpTimeoutMs },
    );
    logger.info('Score submitted to leaderboard', { userId, score, ...meta });
  } catch (err: unknown) {
    logger.warn('Failed to submit score — leaderboard may be unavailable', {
      userId,
      score,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// Resolves the seed for a run, using the cached daily seed for the
// daily-seed mode and a random seed otherwise.
async function resolveSeed(mode: engine.FlappyMode): Promise<number> {
  if (mode !== engine.FlappyMode.DailySeed) return engine.newSeed();
  const dateKey = engine.dailySeedKey();
  const key     = dailySeedKey(dateKey);
  const cached  = await redis.get(key);
  if (cached) return Number(cached);
  const seed = engine.newSeed();
  await redis.setex(key, DAILY_SEED_TTL, String(seed));
  return seed;
}

// Loads (or lazily creates) a profile for the given player.
async function loadOrCreateProfile(playerId: string, playerName: string) {
  const existing = await FlappyProfile.findOne({ playerId });
  if (existing) return existing;
  const created = await FlappyProfile.create({ playerId, playerName });
  return created;
}

// Builds the PlayerUnlocks bundle that engine helpers expect.
function profileToUnlocks(p: {
  unlockedSkins: string[];
  unlockedPipes: string[];
  unlockedBackgrounds: string[];
  unlockedTrails: string[];
  unlockedAudio: string[];
}): engine.PlayerUnlocks {
  return {
    skins:       p.unlockedSkins,
    pipes:       p.unlockedPipes,
    backgrounds: p.unlockedBackgrounds,
    trails:      p.unlockedTrails,
    audio:       p.unlockedAudio,
  };
}

// ── GET /config — returns the static mode/cosmetics catalogue ──────

export const getConfig = wrap(async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      modes: Object.values(engine.MODES).map(m => ({
        id:              m.id,
        label:           m.label,
        description:     m.description,
        physics:         m.physics,
        scoreMultiplier: m.scoreMultiplier,
        durationCapSec:  m.durationCapSec ?? null,
      })),
      cosmetics:    engine.COSMETICS,
      unlockRules:  engine.UNLOCK_RULES,
      defaultLoadout: engine.DEFAULT_LOADOUT,
    },
  });
});

// ── POST /games — start a new run ──────────────────────────────────

export const createGame = wrap(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as CreateGameBody;
  const user = extractUser(req);
  const mode = engine.normaliseMode(body.mode);
  const def  = engine.getMode(mode);

  // Server is the source of truth for physics — client requests are ignored
  // for ranked modes. Custom physics would be a separate "casual" flag we
  // could add later, but ranked runs all use the mode's canonical settings.
  const physics = def.physics;
  const cosmetics = engine.normaliseLoadout(body.cosmetics);

  const playerId   = user?.id       ?? ANONYMOUS_PLAYER;
  const playerName = user?.username ?? GUEST_PLAYER_NAME;
  const gameId     = uuidv4();
  const startedAt  = new Date().toISOString();
  const seed       = await resolveSeed(mode);
  const signature  = engine.signRun(config.jwt.secret, gameId, seed, mode, playerId, startedAt);

  const doc = await FlappySession.create({
    gameId,
    mode,
    seed,
    physics,
    cosmetics,
    signature,
    status: 'active',
    playerId,
    playerName,
    startedAt: new Date(startedAt),
  });

  await redis.setex(gameKey(gameId), GAME_STATE_TTL, JSON.stringify({
    gameId,
    mode,
    seed,
    physics,
    cosmetics,
    signature,
    status: 'active',
    playerId,
    playerName,
    startedAt,
  }));

  logger.info('New flappy game created', { gameId, mode, playerId });
  gamesMetrics.gameStartedTotal.add(1, { game: GAME_LABEL, mode });

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    data: {
      gameId:     doc.gameId,
      mode:       doc.mode,
      seed:       doc.seed,
      physics:    doc.physics,
      cosmetics:  doc.cosmetics,
      signature:  doc.signature,
      startedAt,
      durationCapSec: def.durationCapSec ?? null,
    },
  });
});

// ── POST /games/:id/finish — validate, persist, submit ────────────

export const finishGame = wrap(async (req: Request, res: Response) => {
  const gameId = req.params.id;
  const body   = (req.body ?? {}) as FinishGameBody;

  const session = await FlappySession.findOne({ gameId });
  if (!session) {
    res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, error: 'Game not found' });
    return;
  }
  if (session.status !== 'active') {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: 'Game already finished' });
    return;
  }
  if (!engine.verifySignature(session.signature, body.signature)) {
    logger.warn('Run signature mismatch', { gameId });
    res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, error: 'Invalid run signature' });
    return;
  }

  const run = {
    score:      Number(body.score),
    distance:   Number(body.distance),
    jumps:      Number(body.jumps),
    durationMs: Number(body.durationMs),
  };

  const verdict = engine.validateRun(session.mode as engine.FlappyMode, run, config.game.runMaxDurationSec);

  session.rawScore   = run.score;
  session.distance   = run.distance;
  session.jumps      = run.jumps;
  session.durationMs = run.durationMs;
  session.finishedAt = new Date();

  if (!verdict.ok) {
    session.status       = 'rejected';
    session.rejectReason = verdict.reason;
    session.score        = 0;
    await session.save();
    await redis.del(gameKey(gameId));
    logger.warn('Run rejected by validator', { gameId, reason: verdict.reason, run });
    gamesMetrics.gameFinishedTotal.add(1, { game: GAME_LABEL, mode: session.mode, outcome: 'rejected' });
    res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
      success: false,
      error:   `Run rejected: ${verdict.reason}`,
      data:    { rawScore: run.score },
    });
    return;
  }

  session.status = 'finished';
  session.score  = verdict.finalScore;
  await session.save();
  await redis.del(gameKey(gameId));

  const durationSec = run.durationMs / 1000;
  gamesMetrics.gameFinishedTotal.add(1, { game: GAME_LABEL, mode: session.mode, outcome: 'finished' });
  gamesMetrics.gameScore.record(verdict.finalScore, { game: GAME_LABEL, mode: session.mode });
  gamesMetrics.gameDurationSeconds.record(durationSec, { game: GAME_LABEL, mode: session.mode });
  gamesMetrics.flappyJumpsTotal.add(run.jumps, { game: GAME_LABEL, mode: session.mode, kind: 'flap' });
  gamesMetrics.flappyPipesPassedTotal.add(run.score, { game: GAME_LABEL, mode: session.mode });

  let earnedRules: engine.UnlockRule[] = [];
  let newHigh = false;

  // Submit + persist progress for signed-in players. Anonymous players still
  // get a response with their score; the frontend handles localStorage state.
  if (session.playerId !== ANONYMOUS_PLAYER) {
    const profile = await loadOrCreateProfile(session.playerId, session.playerName);
    const prevHigh = profile.highScores.get(session.mode) ?? 0;
    if (verdict.finalScore > prevHigh) {
      profile.highScores.set(session.mode, verdict.finalScore);
      newHigh = true;
    }
    earnedRules = engine.unlocksEarned(profileToUnlocks(profile), verdict.finalScore);
    if (earnedRules.length > 0) {
      const next = engine.applyUnlocks(profileToUnlocks(profile), earnedRules);
      profile.unlockedSkins       = next.skins;
      profile.unlockedPipes       = next.pipes;
      profile.unlockedBackgrounds = next.backgrounds;
      profile.unlockedTrails      = next.trails;
      profile.unlockedAudio       = next.audio;
    }
    profile.updatedAt = new Date();
    await profile.save();

    void submitScore(session.playerId, session.playerName, verdict.finalScore, {
      mode:       session.mode,
      distance:   run.distance,
      jumps:      run.jumps,
      durationMs: run.durationMs,
    });
  }

  res.json({
    success: true,
    data: {
      gameId:     session.gameId,
      mode:       session.mode,
      score:      verdict.finalScore,
      rawScore:   run.score,
      distance:   run.distance,
      jumps:      run.jumps,
      durationMs: run.durationMs,
      newHighScore: newHigh,
      unlocks:    earnedRules,
    },
  });
});

// ── GET /games/:id — return live state (used for resume / debugging) ─

export const getGame = wrap(async (req: Request, res: Response) => {
  const gameId = req.params.id;
  const cached = await redis.get(gameKey(gameId));
  if (cached) {
    res.json({ success: true, data: JSON.parse(cached) });
    return;
  }
  const doc = await FlappySession.findOne({ gameId });
  if (!doc) {
    res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, error: 'Game not found' });
    return;
  }
  res.json({
    success: true,
    data: {
      gameId:     doc.gameId,
      mode:       doc.mode,
      seed:       doc.seed,
      physics:    doc.physics,
      cosmetics:  doc.cosmetics,
      status:     doc.status,
      score:      doc.score,
      startedAt:  doc.startedAt,
      finishedAt: doc.finishedAt,
    },
  });
});

// ── GET /profile/me — auth required ────────────────────────────────

export const getMyProfile = wrap(async (req: Request, res: Response) => {
  const user = extractUser(req);
  if (!user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, error: 'Sign in to access your profile' });
    return;
  }
  const profile = await loadOrCreateProfile(user.id, user.username);
  res.json({
    success: true,
    data: {
      playerId:           profile.playerId,
      playerName:         profile.playerName,
      unlockedSkins:      profile.unlockedSkins,
      unlockedPipes:      profile.unlockedPipes,
      unlockedBackgrounds: profile.unlockedBackgrounds,
      unlockedTrails:     profile.unlockedTrails,
      unlockedAudio:      profile.unlockedAudio,
      selected:           profile.selected,
      highScores:         Object.fromEntries(profile.highScores),
    },
  });
});

// ── PUT /profile/cosmetics — save selected loadout ────────────────

export const saveLoadout = wrap(async (req: Request, res: Response) => {
  const user = extractUser(req);
  if (!user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, error: 'Sign in to save cosmetics' });
    return;
  }
  const incoming = engine.normaliseLoadout(req.body as Partial<engine.CosmeticLoadout> | undefined);
  const profile  = await loadOrCreateProfile(user.id, user.username);

  // Only accept selections the player has actually unlocked. Silently coerce
  // any locked selection back to the existing value (or the default).
  const unlocks = profileToUnlocks(profile);
  const safe: engine.CosmeticLoadout = {
    skin:       unlocks.skins.includes(incoming.skin)             ? incoming.skin       : profile.selected.skin,
    pipe:       unlocks.pipes.includes(incoming.pipe)             ? incoming.pipe       : profile.selected.pipe,
    background: unlocks.backgrounds.includes(incoming.background) ? incoming.background : profile.selected.background,
    trail:      unlocks.trails.includes(incoming.trail)           ? incoming.trail      : profile.selected.trail,
    audio:      unlocks.audio.includes(incoming.audio)            ? incoming.audio      : profile.selected.audio,
  };

  profile.selected  = safe;
  profile.updatedAt = new Date();
  await profile.save();

  res.json({ success: true, data: { selected: safe } });
});
