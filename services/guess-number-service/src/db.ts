import mongoose, { Schema, Document } from 'mongoose';
import Redis from 'ioredis';

export interface IGuessSession extends Document {
  gameId: string;
  secret: number;
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
  maxAttempts: { type: Number, default: 7 },
  guesses:     [{ value: Number, hint: String, timestamp: { type: Date, default: Date.now } }],
  status:      { type: String, enum: ['active', 'won', 'lost'], default: 'active' },
  playerId:    { type: String },
  playerName:  { type: String },
  createdAt:   { type: Date, default: Date.now },
  finishedAt:  { type: Date },
});

export const GuessSession = mongoose.model<IGuessSession>('GuessSession', GuessSessionSchema);

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

export const GAME_STATE_TTL = 3600;
export const gameKey = (id: string) => `game:guess:${id}`;

export async function connect() {
  await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/games');
  await redis.connect();
  console.log('[guess-number-service] MongoDB + Redis connected');
}

export async function disconnect() {
  await mongoose.disconnect();
  redis.quit();
}
