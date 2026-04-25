import mongoose, { Schema, Document } from 'mongoose';
import Redis from 'ioredis';

// ── MongoDB ────────────────────────────────────────────────────────
export interface ITicTacToeSession extends Document {
  gameId: string;
  board: (string | null)[];
  currentPlayer: 'X' | 'O';
  status: 'active' | 'finished';
  winner: string | null; // 'X', 'O', 'draw', or null
  playerX?: string;
  playerO?: string;
  moves: { player: string; position: number; symbol: 'X' | 'O'; timestamp: Date }[];
  createdAt: Date;
  finishedAt?: Date;
}

const TicTacToeSessionSchema = new Schema<ITicTacToeSession>({
  gameId:        { type: String, required: true, unique: true, index: true },
  board:         { type: [Schema.Types.Mixed], default: Array(9).fill(null) },
  currentPlayer: { type: String, enum: ['X', 'O'], default: 'X' },
  status:        { type: String, enum: ['active', 'finished'], default: 'active' },
  winner:        { type: String, default: null },
  playerX:       { type: String },
  playerO:       { type: String },
  moves:         [{ player: String, position: Number, symbol: String, timestamp: { type: Date, default: Date.now } }],
  createdAt:     { type: Date, default: Date.now },
  finishedAt:    { type: Date },
});

export const TicTacToeSession = mongoose.model<ITicTacToeSession>('TicTacToeSession', TicTacToeSessionSchema);

// ── Redis ─────────────────────────────────────────────────────────
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

export const GAME_STATE_TTL = 3600; // 1 hour
export const gameKey = (id: string) => `game:ttt:${id}`;

export async function connect() {
  await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/games');
  await redis.connect();
  console.log('[tic-tac-toe-service] MongoDB + Redis connected');
}

export async function disconnect() {
  await mongoose.disconnect();
  redis.quit();
}
