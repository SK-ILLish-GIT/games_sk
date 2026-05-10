import mongoose, { Schema, Document } from 'mongoose';
import Redis from 'ioredis';

import { config } from './config';
import { logger } from './utils/logger';

export interface IHangmanSession extends Document {
  gameId: string;
  word: string;             // Never exposed to the client while active
  difficulty: 'easy' | 'medium' | 'hard';
  guessedLetters: string[];
  wrongGuesses: number;
  maxWrong: number;
  guesses: { kind: 'letter' | 'word'; value: string; correct: boolean; timestamp: Date }[];
  status: 'active' | 'won' | 'lost';
  playerId?: string;
  playerName?: string;
  createdAt: Date;
  finishedAt?: Date;
}

const HangmanSessionSchema = new Schema<IHangmanSession>({
  gameId:         { type: String, required: true, unique: true, index: true },
  word:           { type: String, required: true },
  difficulty:     { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  guessedLetters: { type: [String], default: [] },
  wrongGuesses:   { type: Number, default: 0 },
  maxWrong:       { type: Number, default: config.game.maxWrong },
  guesses:        [{
    kind:      { type: String, enum: ['letter', 'word'] },
    value:     String,
    correct:   Boolean,
    timestamp: { type: Date, default: Date.now },
  }],
  status:         { type: String, enum: ['active', 'won', 'lost'], default: 'active' },
  playerId:       { type: String },
  playerName:     { type: String },
  createdAt:      { type: Date, default: Date.now },
  finishedAt:     { type: Date },
});

export const HangmanSession = mongoose.model<IHangmanSession>('HangmanSession', HangmanSessionSchema);

export const redis = new Redis(config.db.redisUrl, {
  lazyConnect: true,
  // Exponential-like backoff capped at 3s to avoid hammering Redis on restarts
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

// Cache TTL mirrors config (default 1 hour)
export const GAME_STATE_TTL = config.game.stateTtl;
export const gameKey = (id: string) => `game:hangman:${id}`;

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
