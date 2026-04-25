// ── Users ─────────────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'player' | 'admin';
  createdAt: string;
}

export interface JWTPayload {
  sub: string;       // user id
  username: string;
  role: 'player' | 'admin';
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: Pick<User, 'id' | 'username' | 'role'>;
}

// ── Scores / Leaderboard ─────────────────────────────────────────
export type GameId = 'tic-tac-toe' | 'guess-number' | string;

export interface ScoreEntry {
  id: string;
  userId: string;
  username: string;
  gameId: GameId;
  score: number;
  metadata?: Record<string, unknown>;
  playedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
  gameId?: GameId;
}

export interface SubmitScorePayload {
  userId: string;
  username: string;
  gameId: GameId;
  score: number;
  metadata?: Record<string, unknown>;
}

// ── Game Sessions ─────────────────────────────────────────────────
export type GameStatus = 'waiting' | 'active' | 'finished';

export interface GameSession {
  id: string;
  gameType: GameId;
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
  status: 'ok' | 'degraded';
  service: string;
  db?: string;
  redis?: string;
  uptime?: number;
}
