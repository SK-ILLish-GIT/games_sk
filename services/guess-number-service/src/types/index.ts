import { Hint } from '../game/engine';

// ── A single guess record stored in a session ─────────────────────
export interface GuessRecord {
  value:     number;
  hint:      Hint;
  timestamp: string;
}

// ── Full in-memory / Redis game state (excludes MongoDB _id) ──────
export interface GameState {
  gameId:      string;
  secret:      number;
  attempts:    number;
  maxAttempts: number;
  guesses:     GuessRecord[];
  status:      'active' | 'won' | 'lost';
  playerId:    string;
  playerName:  string;
  createdAt:   string;
  finishedAt?: string;
}

// ── Client-safe view (secret stripped) ────────────────────────────
export type SafeGameState = Omit<GameState, 'secret'>;

// ── HTTP error shape forwarded to global error handler ───────────
export interface HttpError extends Error {
  status?: number;
  code?:   string;
}

// ── JWT payload extracted from Bearer token ───────────────────────
export interface JwtUserPayload {
  sub:      string;
  username: string;
  role?:    string;
  iat?:     number;
  exp?:     number;
}
