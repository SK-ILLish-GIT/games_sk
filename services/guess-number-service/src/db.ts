import mongoose, { Schema, Document } from 'mongoose';
import Redis from 'ioredis';

import { config } from './config';
import { logger } from './utils/logger';

export interface IGuessSession extends Document {
  gameId: string;
  secret: number;       // Never exposed to the client
  attempts: number;
  maxAttempts: number;
  guesses: { value: number; hint: 'too-low' | 'too-high' | 'correct'; timestamp: Date }[];
  status: 'active' | 'won' | 'lost';
  playerId?: string;
  playerName?: string;
  createdAt: Date;
  finishedAt?: Date;
}

const GuessSessionSchema = new Schema<IGuessSession>({
  gameId:      { type: String, required: true, unique: true, index: true },
  secret:      { type: Number, required: true },
  attempts:    { type: Number, default: 0 },
  maxAttempts: { type: Number, default: config.game.maxAttempts },
  guesses:     [{ value: Number, hint: String, timestamp: { type: Date, default: Date.now } }],
  status:      { type: String, enum: ['active', 'won', 'lost'], default: 'active' },
  playerId:    { type: String },
  playerName:  { type: String },
  createdAt:   { type: Date, default: Date.now },
  finishedAt:  { type: Date },
});

export const GuessSession = mongoose.model<IGuessSession>('GuessSession', GuessSessionSchema);

export const redis = new Redis(config.db.redisUrl, {
  lazyConnect: true,
  // Exponential-like backoff capped at 3s to avoid hammering Redis on restarts
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

// Cache TTL mirrors config (default 1 hour)
export const GAME_STATE_TTL = config.game.stateTtl;
export const gameKey = (id: string) => `game:guess:${id}`;

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
