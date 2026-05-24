// Pure game logic for Flappy Bird — no I/O, fully testable.
//
// Server authority lives here: the client runs the sim at 60 fps for snappy
// feedback, but the server defines every mode's physics + scoring cap and
// validates the submitted run against those constants before passing the
// score to the leaderboard service.

import { createHmac, timingSafeEqual } from 'crypto';

import { RUN_VALIDATION } from '../constants/game.constants';

// ── Public enums and shapes ────────────────────────────────────────

export enum FlappyMode {
  Endless     = 'endless',
  TimeAttack  = 'time-attack',
  GravityFlip = 'gravity-flip',
  Reverse     = 'reverse',
  Chaos       = 'chaos',
  DailySeed   = 'daily-seed',
}

export interface PhysicsSettings {
  gravity:      number;   // px / s^2 (positive pulls bird down)
  jumpVel:      number;   // px / s (negative on flap)
  pipeGap:      number;   // px between top and bottom pipe
  pipeSpeed:    number;   // px / s horizontal scroll
  pipeInterval: number;   // s between pipe spawns
}

export interface ModeDefinition {
  id:              FlappyMode;
  label:           string;
  description:     string;
  physics:         PhysicsSettings;
  scoreMultiplier: number;
  // Theoretical ceiling: how many points a flawless run could earn per second.
  // 1 point per pipe passed; pipes spawn every `pipeInterval`s, so the rate is
  // 1 / pipeInterval, scaled by the score multiplier.
  maxScorePerSec:  number;
  // For time-attack we hard-cap the run duration.
  durationCapSec?: number;
}

export interface CosmeticLoadout {
  skin:       string;
  pipe:       string;
  background: string;
  trail:      string;
  audio:      string;
}

export interface UnlockRule {
  cosmetic: string;       // id of the cosmetic
  category: 'skin' | 'pipe' | 'background' | 'trail' | 'audio';
  minScore: number;       // threshold in any single run
  label:    string;
  emoji:    string;
}

export interface SubmittedRun {
  score:      number;
  distance:   number;
  jumps:      number;
  durationMs: number;
}

export type RunValidation =
  | { ok: true; finalScore: number }
  | { ok: false; reason: string };

// ── Helpers ────────────────────────────────────────────────────────

function defPhysics(p: PhysicsSettings, multiplier = 1): { physics: PhysicsSettings; max: number } {
  const max = (1 / p.pipeInterval) * multiplier;
  return { physics: p, max };
}

// ── Modes catalogue ────────────────────────────────────────────────
// Tuned so that "normal" play yields ~1 point every 1.5s.

const ENDLESS_PHYSICS: PhysicsSettings = {
  gravity:      1400,
  jumpVel:      -380,
  pipeGap:      150,
  pipeSpeed:    180,
  pipeInterval: 1.5,
};

export const MODES: Record<FlappyMode, ModeDefinition> = {
  [FlappyMode.Endless]: {
    id:              FlappyMode.Endless,
    label:           'Endless',
    description:     'Classic flappy: survive as long as you can.',
    physics:         ENDLESS_PHYSICS,
    scoreMultiplier: 1,
    maxScorePerSec:  defPhysics(ENDLESS_PHYSICS, 1).max,
  },
  [FlappyMode.TimeAttack]: {
    id:              FlappyMode.TimeAttack,
    label:           'Time Attack',
    description:     'Sixty seconds. Score as much as possible.',
    physics:         { ...ENDLESS_PHYSICS, pipeInterval: 1.1, pipeSpeed: 220 },
    scoreMultiplier: 1.5,
    durationCapSec:  60,
    maxScorePerSec:  defPhysics({ ...ENDLESS_PHYSICS, pipeInterval: 1.1, pipeSpeed: 220 }, 1.5).max,
  },
  [FlappyMode.GravityFlip]: {
    id:              FlappyMode.GravityFlip,
    label:           'Gravity Flip',
    description:     'Gravity inverts every 5 pipes. Stay oriented.',
    physics:         { ...ENDLESS_PHYSICS, pipeGap: 165 },
    scoreMultiplier: 1.75,
    maxScorePerSec:  defPhysics({ ...ENDLESS_PHYSICS, pipeGap: 165 }, 1.75).max,
  },
  [FlappyMode.Reverse]: {
    id:              FlappyMode.Reverse,
    label:           'Reverse',
    description:     'Pipes scroll the other way. Brain hurts.',
    physics:         ENDLESS_PHYSICS,
    scoreMultiplier: 1.5,
    maxScorePerSec:  defPhysics(ENDLESS_PHYSICS, 1.5).max,
  },
  [FlappyMode.Chaos]: {
    id:              FlappyMode.Chaos,
    label:           'Chaos',
    description:     'Random modifier per pipe. Anything goes.',
    physics:         { ...ENDLESS_PHYSICS, pipeGap: 170 },
    scoreMultiplier: 2,
    maxScorePerSec:  defPhysics({ ...ENDLESS_PHYSICS, pipeGap: 170 }, 2).max,
  },
  [FlappyMode.DailySeed]: {
    id:              FlappyMode.DailySeed,
    label:           'Daily Seed',
    description:     'Same level for everyone today. Fair leaderboard.',
    physics:         ENDLESS_PHYSICS,
    scoreMultiplier: 1.25,
    maxScorePerSec:  defPhysics(ENDLESS_PHYSICS, 1.25).max,
  },
};

// ── Cosmetics catalogue ────────────────────────────────────────────
// Each cosmetic is referenced by id; the frontend renders the visuals.

export const COSMETICS = {
  skins: [
    { id: 'classic',     label: 'Classic',     emoji: '🐤' },
    { id: 'phoenix',     label: 'Phoenix',     emoji: '🔥' },
    { id: 'ninja',       label: 'Ninja',       emoji: '🥷' },
    { id: 'ufo',         label: 'UFO',         emoji: '🛸' },
    { id: 'pixel',       label: '8-bit Pixel', emoji: '👾' },
    { id: 'rubber-duck', label: 'Rubber Duck', emoji: '🦆' },
    { id: 'rocket',      label: 'Rocket',      emoji: '🚀' },
  ],
  pipes: [
    { id: 'classic-green', label: 'Classic Green', emoji: '🟩' },
    { id: 'neon',          label: 'Neon',          emoji: '💚' },
    { id: 'candy',         label: 'Candy',         emoji: '🍭' },
    { id: 'lava',          label: 'Lava',          emoji: '🌋' },
    { id: 'ice',           label: 'Ice',           emoji: '🧊' },
    { id: 'glass',         label: 'Glass',         emoji: '🪟' },
    { id: 'cactus',        label: 'Cactus',        emoji: '🌵' },
  ],
  backgrounds: [
    { id: 'day',         label: 'Sunny Day',  emoji: '☀️' },
    { id: 'sunset',      label: 'Sunset',     emoji: '🌇' },
    { id: 'night',       label: 'Night',      emoji: '🌃' },
    { id: 'space',       label: 'Space',      emoji: '🌌' },
    { id: 'underwater',  label: 'Underwater', emoji: '🌊' },
    { id: 'vaporwave',   label: 'Vaporwave',  emoji: '🌴' },
    { id: 'matrix',      label: 'Matrix',     emoji: '💾' },
  ],
  trails: [
    { id: 'none',     label: 'None',     emoji: '⚪' },
    { id: 'flame',    label: 'Flame',    emoji: '🔥' },
    { id: 'sparkles', label: 'Sparkles', emoji: '✨' },
    { id: 'rainbow',  label: 'Rainbow',  emoji: '🌈' },
    { id: 'smoke',    label: 'Smoke',    emoji: '💨' },
    { id: 'bubble',   label: 'Bubble',   emoji: '🫧' },
  ],
  audio: [
    { id: 'chiptune',  label: 'Chiptune',  emoji: '🎮' },
    { id: 'lofi',      label: 'Lo-Fi',     emoji: '🎧' },
    { id: 'synthwave', label: 'Synthwave', emoji: '🎹' },
    { id: 'mute',      label: 'Mute',      emoji: '🔇' },
  ],
} as const;

// ── Default loadout (always free, no unlock required) ──────────────
export const DEFAULT_LOADOUT: CosmeticLoadout = {
  skin:       'classic',
  pipe:       'classic-green',
  background: 'day',
  trail:      'none',
  audio:      'chiptune',
};

// ── Unlock rules ───────────────────────────────────────────────────
// Players unlock cosmetics by hitting a score threshold in any mode.
// Thresholds are tuned to feel rewarding within the first handful of runs.

export const UNLOCK_RULES: UnlockRule[] = [
  { cosmetic: 'flame',       category: 'trail',      minScore: 3,   label: 'Flame trail',       emoji: '🔥' },
  { cosmetic: 'rubber-duck', category: 'skin',       minScore: 5,   label: 'Rubber Duck skin',  emoji: '🦆' },
  { cosmetic: 'candy',       category: 'pipe',       minScore: 8,   label: 'Candy pipes',       emoji: '🍭' },
  { cosmetic: 'night',       category: 'background', minScore: 10,  label: 'Night background',  emoji: '🌃' },
  { cosmetic: 'pixel',       category: 'skin',       minScore: 15,  label: '8-bit Pixel skin',  emoji: '👾' },
  { cosmetic: 'lava',        category: 'pipe',       minScore: 18,  label: 'Lava pipes',        emoji: '🌋' },
  { cosmetic: 'bubble',      category: 'trail',      minScore: 22,  label: 'Bubble trail',      emoji: '🫧' },
  { cosmetic: 'space',       category: 'background', minScore: 26,  label: 'Space background',  emoji: '🌌' },
  { cosmetic: 'ninja',       category: 'skin',       minScore: 30,  label: 'Ninja skin',        emoji: '🥷' },
  { cosmetic: 'synthwave',   category: 'audio',      minScore: 35,  label: 'Synthwave audio',   emoji: '🎹' },
  { cosmetic: 'ice',         category: 'pipe',       minScore: 40,  label: 'Ice pipes',         emoji: '🧊' },
  { cosmetic: 'underwater',  category: 'background', minScore: 45,  label: 'Underwater bg',     emoji: '🌊' },
  { cosmetic: 'smoke',       category: 'trail',      minScore: 50,  label: 'Smoke trail',       emoji: '💨' },
  { cosmetic: 'vaporwave',   category: 'background', minScore: 60,  label: 'Vaporwave bg',      emoji: '🌴' },
  { cosmetic: 'glass',       category: 'pipe',       minScore: 75,  label: 'Glass pipes',       emoji: '🪟' },
  { cosmetic: 'rocket',      category: 'skin',       minScore: 90,  label: 'Rocket skin',       emoji: '🚀' },
  { cosmetic: 'rainbow',     category: 'trail',      minScore: 110, label: 'Rainbow trail',     emoji: '🌈' },
  { cosmetic: 'matrix',      category: 'background', minScore: 130, label: 'Matrix background', emoji: '💾' },
  { cosmetic: 'cactus',      category: 'pipe',       minScore: 150, label: 'Cactus pipes',      emoji: '🌵' },
  { cosmetic: 'ufo',         category: 'skin',       minScore: 200, label: 'UFO skin',          emoji: '🛸' },
];

// Default unlocks given to every fresh profile — these never lock behind score.
// Pre-unlocking one extra item per category so the customization panel feels
// alive on a brand-new account.
export const DEFAULT_UNLOCKS = {
  skins:       ['classic', 'phoenix'],
  pipes:       ['classic-green', 'neon'],
  backgrounds: ['day', 'sunset'],
  trails:      ['none', 'sparkles'],
  audio:       ['chiptune', 'mute', 'lofi'],
};

// ── Mode resolution ────────────────────────────────────────────────

export function normaliseMode(value: unknown): FlappyMode {
  if (typeof value === 'string' && (Object.values(FlappyMode) as string[]).includes(value)) {
    return value as FlappyMode;
  }
  return FlappyMode.Endless;
}

export function getMode(mode: FlappyMode): ModeDefinition {
  return MODES[mode];
}

// ── Cosmetic resolution ────────────────────────────────────────────

const VALID_COSMETIC_IDS: {
  skin:       Set<string>;
  pipe:       Set<string>;
  background: Set<string>;
  trail:      Set<string>;
  audio:      Set<string>;
} = {
  skin:       new Set<string>(COSMETICS.skins.map(c => c.id)),
  pipe:       new Set<string>(COSMETICS.pipes.map(c => c.id)),
  background: new Set<string>(COSMETICS.backgrounds.map(c => c.id)),
  trail:      new Set<string>(COSMETICS.trails.map(c => c.id)),
  audio:      new Set<string>(COSMETICS.audio.map(c => c.id)),
};

export function normaliseLoadout(input: Partial<CosmeticLoadout> | undefined): CosmeticLoadout {
  const safe: CosmeticLoadout = { ...DEFAULT_LOADOUT };
  if (!input) return safe;
  if (typeof input.skin       === 'string' && VALID_COSMETIC_IDS.skin.has(input.skin))             safe.skin       = input.skin;
  if (typeof input.pipe       === 'string' && VALID_COSMETIC_IDS.pipe.has(input.pipe))             safe.pipe       = input.pipe;
  if (typeof input.background === 'string' && VALID_COSMETIC_IDS.background.has(input.background)) safe.background = input.background;
  if (typeof input.trail      === 'string' && VALID_COSMETIC_IDS.trail.has(input.trail))           safe.trail      = input.trail;
  if (typeof input.audio      === 'string' && VALID_COSMETIC_IDS.audio.has(input.audio))           safe.audio      = input.audio;
  return safe;
}

// ── Seed generation ────────────────────────────────────────────────

export function newSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

export function dailySeedKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── HMAC signing for run integrity ─────────────────────────────────
// Server signs the run-start payload; client echoes the signature back on
// /finish. Prevents replay and trivial score forging.

export function signRun(secret: string, gameId: string, seed: number, mode: FlappyMode, playerId: string, startedAt: string): string {
  return createHmac('sha256', secret)
    .update(`${gameId}|${seed}|${mode}|${playerId}|${startedAt}`)
    .digest('hex');
}

export function verifySignature(expected: string, provided: unknown): boolean {
  if (typeof provided !== 'string' || provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false;
  }
}

// ── Run validation ─────────────────────────────────────────────────
// All client-submitted runs flow through this. Failures still persist the
// session (for analytics) but don't reach the leaderboard.

export function validateRun(mode: FlappyMode, run: SubmittedRun, runMaxDurationSec: number): RunValidation {
  const def = getMode(mode);
  const { score, distance, jumps, durationMs } = run;

  if (!Number.isFinite(score) || score < 0)         return { ok: false, reason: 'invalid_score' };
  if (!Number.isFinite(distance) || distance < 0)   return { ok: false, reason: 'invalid_distance' };
  if (!Number.isFinite(jumps) || jumps < 0)         return { ok: false, reason: 'invalid_jumps' };
  if (!Number.isFinite(durationMs) || durationMs < 0) return { ok: false, reason: 'invalid_duration' };
  if (score > 100_000)                              return { ok: false, reason: 'score_overflow' };

  const durationSec = durationMs / 1000;
  if (durationSec > runMaxDurationSec)              return { ok: false, reason: 'duration_exceeds_cap' };
  if (def.durationCapSec && durationSec > def.durationCapSec + 2) {
    return { ok: false, reason: 'duration_exceeds_mode_cap' };
  }

  const maxAllowedScore = durationSec * def.maxScorePerSec * RUN_VALIDATION.scoreSlack + 5;
  if (score > maxAllowedScore) return { ok: false, reason: 'score_rate_exceeded' };

  const maxAllowedJumps = durationSec * RUN_VALIDATION.maxFlapsPerSec + 20;
  if (jumps > maxAllowedJumps) return { ok: false, reason: 'flap_rate_exceeded' };

  // Distance should track time × pipe speed within slack on both sides.
  const expectedDistance = durationSec * def.physics.pipeSpeed;
  const lo = expectedDistance * (1 - RUN_VALIDATION.distanceSlack);
  const hi = expectedDistance * (1 + RUN_VALIDATION.distanceSlack) + 50;
  if (distance < lo - 50 || distance > hi) return { ok: false, reason: 'distance_inconsistent' };

  const finalScore = Math.round(score * def.scoreMultiplier);
  return { ok: true, finalScore };
}

// ── Unlock derivation ──────────────────────────────────────────────
// Returns the cosmetics newly unlocked by hitting `newScore`, given the
// player's prior unlock set.

export interface PlayerUnlocks {
  skins:       string[];
  pipes:       string[];
  backgrounds: string[];
  trails:      string[];
  audio:       string[];
}

function bucketFor(unlocks: PlayerUnlocks, category: UnlockRule['category']): string[] {
  switch (category) {
    case 'skin':       return unlocks.skins;
    case 'pipe':       return unlocks.pipes;
    case 'background': return unlocks.backgrounds;
    case 'trail':      return unlocks.trails;
    case 'audio':      return unlocks.audio;
  }
}

export function unlocksEarned(prev: PlayerUnlocks, newScore: number): UnlockRule[] {
  const earned: UnlockRule[] = [];
  for (const rule of UNLOCK_RULES) {
    if (newScore < rule.minScore) continue;
    if (bucketFor(prev, rule.category).includes(rule.cosmetic)) continue;
    earned.push(rule);
  }
  return earned;
}

export function applyUnlocks(prev: PlayerUnlocks, earned: UnlockRule[]): PlayerUnlocks {
  const next: PlayerUnlocks = {
    skins:       [...prev.skins],
    pipes:       [...prev.pipes],
    backgrounds: [...prev.backgrounds],
    trails:      [...prev.trails],
    audio:       [...prev.audio],
  };
  for (const rule of earned) {
    const bucket = bucketFor(next, rule.category);
    if (!bucket.includes(rule.cosmetic)) bucket.push(rule.cosmetic);
  }
  return next;
}
