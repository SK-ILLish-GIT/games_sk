export { GameId, UserRole, HealthStatus } from './enums/game.enum';

// ── Users ─────────────────────────────────────────────────────────
import { UserRole } from './enums/game.enum';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface JWTPayload {
  sub: string;       // user id
  username: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: Pick<User, 'id' | 'username' | 'role'>;
}

// ── Scores / Leaderboard ─────────────────────────────────────────
import { GameId } from './enums/game.enum';

export interface ScoreEntry {
  id: string;
  userId: string;
  username: string;
  gameId: GameId | string;
  score: number;
  metadata?: Record<string, unknown>;
  playedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
  gameId?: GameId | string;
}

export interface SubmitScorePayload {
  userId: string;
  username: string;
  gameId: GameId | string;
  score: number;
  metadata?: Record<string, unknown>;
}

// ── Game Sessions ─────────────────────────────────────────────────
import { HealthStatus } from './enums/game.enum';

export type GameStatus = 'waiting' | 'active' | 'finished';

export interface GameSession {
  id: string;
  gameType: GameId | string;
  players: string[];   // user IDs
  state: unknown;      // game-specific
  status: GameStatus;
  winner?: string | null;
  createdAt: string;
  finishedAt?: string;
}

// ── API response wrappers ─────────────────────────────────────────
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Health check ─────────────────────────────────────────────────
export interface HealthCheck {
  status: HealthStatus;
  service: string;
  db?: string;
  redis?: string;
  uptime?: number;
}
