import mongoose, { Schema, Document } from 'mongoose';
import Redis from 'ioredis';

import { config } from './config';
import { logger } from './utils/logger';
import { REDIS_KEY_PREFIX } from './constants/game.constants';
import { FlappyMode, CosmeticLoadout, PhysicsSettings, DEFAULT_LOADOUT, DEFAULT_UNLOCKS } from './game/engine';

// ── Active run session ────────────────────────────────────────────
export interface IFlappySession extends Document {
  gameId:        string;
  mode:          FlappyMode;
  seed:          number;
  physics:       PhysicsSettings;
  cosmetics:     CosmeticLoadout;
  signature:     string;
  status:        'active' | 'finished' | 'rejected';
  score:         number;
  rawScore:      number;
  distance:      number;
  jumps:         number;
  durationMs:    number;
  rejectReason?: string;
  playerId:      string;
  playerName:    string;
  startedAt:     Date;
  finishedAt?:   Date;
}

const PhysicsSchema = new Schema<PhysicsSettings>(
  {
    gravity:      { type: Number, required: true },
    jumpVel:      { type: Number, required: true },
    pipeGap:      { type: Number, required: true },
    pipeSpeed:    { type: Number, required: true },
    pipeInterval: { type: Number, required: true },
  },
  { _id: false },
);

const CosmeticSchema = new Schema<CosmeticLoadout>(
  {
    skin:       { type: String, required: true },
    pipe:       { type: String, required: true },
    background: { type: String, required: true },
    trail:      { type: String, required: true },
    audio:      { type: String, required: true },
  },
  { _id: false },
);

const FlappySessionSchema = new Schema<IFlappySession>({
  gameId:       { type: String, required: true, unique: true, index: true },
  mode:         { type: String, required: true, enum: Object.values(FlappyMode) },
  seed:         { type: Number, required: true },
  physics:      { type: PhysicsSchema, required: true },
  cosmetics:    { type: CosmeticSchema, required: true },
  signature:    { type: String, required: true },
  status:       { type: String, enum: ['active', 'finished', 'rejected'], default: 'active' },
  score:        { type: Number, default: 0 },
  rawScore:     { type: Number, default: 0 },
  distance:     { type: Number, default: 0 },
  jumps:        { type: Number, default: 0 },
  durationMs:   { type: Number, default: 0 },
  rejectReason: { type: String },
  playerId:     { type: String, required: true, index: true },
  playerName:   { type: String, required: true },
  startedAt:    { type: Date, default: Date.now },
  finishedAt:   { type: Date },
});

export const FlappySession = mongoose.model<IFlappySession>('FlappySession', FlappySessionSchema);

// ── Player profile: unlocks + selected loadout + per-mode high scores ─

export interface IFlappyProfile extends Document {
  playerId:           string;
  playerName:         string;
  unlockedSkins:      string[];
  unlockedPipes:      string[];
  unlockedBackgrounds: string[];
  unlockedTrails:     string[];
  unlockedAudio:      string[];
  selected:           CosmeticLoadout;
  highScores:         Map<string, number>;
  updatedAt:          Date;
}

const FlappyProfileSchema = new Schema<IFlappyProfile>({
  playerId:           { type: String, required: true, unique: true, index: true },
  playerName:         { type: String, required: true },
  unlockedSkins:      { type: [String], default: () => [...DEFAULT_UNLOCKS.skins] },
  unlockedPipes:      { type: [String], default: () => [...DEFAULT_UNLOCKS.pipes] },
  unlockedBackgrounds: { type: [String], default: () => [...DEFAULT_UNLOCKS.backgrounds] },
  unlockedTrails:     { type: [String], default: () => [...DEFAULT_UNLOCKS.trails] },
  unlockedAudio:      { type: [String], default: () => [...DEFAULT_UNLOCKS.audio] },
  selected:           { type: CosmeticSchema, default: () => ({ ...DEFAULT_LOADOUT }) },
  highScores:         { type: Map, of: Number, default: () => new Map() },
  updatedAt:          { type: Date, default: Date.now },
});

export const FlappyProfile = mongoose.model<IFlappyProfile>('FlappyProfile', FlappyProfileSchema);

// ── Redis ─────────────────────────────────────────────────────────
export const redis = new Redis(config.db.redisUrl, {
  lazyConnect: true,
  // Exponential-like backoff capped at 3s to avoid hammering Redis on restarts
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

export const GAME_STATE_TTL = config.game.stateTtl;
export const DAILY_SEED_TTL = config.game.dailySeedTtl;

export const gameKey      = (id: string)   => `${REDIS_KEY_PREFIX.GAME}:${id}`;
export const dailySeedKey = (date: string) => `${REDIS_KEY_PREFIX.DAILY_SEED}:${date}`;

// ── Lifecycle ─────────────────────────────────────────────────────
export async function connect() {
  await mongoose.connect(config.db.mongoUri);
  await redis.connect();
  logger.info('MongoDB + Redis connected');
}

export async function disconnect() {
  await mongoose.disconnect();
  redis.quit();
  logger.info('MongoDB + Redis disconnected');
}
