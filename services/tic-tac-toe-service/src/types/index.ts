import type { Player, GameResult } from '../game/engine';

// ── A recorded move within a TTT session ─────────────────────────
export interface MoveRecord {
  player: string;
  position: number;
  symbol: Player;
  timestamp: string;
}

// ── Full in-memory / Redis game state ────────────────────────────
export interface TicTacToeState {
  gameId: string;
  board: (string | null)[];
  currentPlayer: Player;
  status: 'active' | 'finished';
  winner: GameResult;
  playerX: string;
  playerO: string | null;
  moves: MoveRecord[];
  createdAt: string;
  finishedAt?: string;
}

// ── HTTP error shape forwarded to global error handler ───────────
export interface HttpError extends Error {
  status?: number;
  code?: string;
}

// ── JWT payload extracted from Bearer token ───────────────────────
export interface JwtUserPayload {
  sub: string;
  username: string;
  role?: string;
  iat?: number;
  exp?: number;
}
