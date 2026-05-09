// ── User identity ──────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  role: 'player' | 'admin';
  email?: string;
}

// ── Auth Context contract ─────────────────────────────────────────
export interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ── Auth API response shapes ──────────────────────────────────────
export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}


// ── Leaderboard ───────────────────────────────────────────────────
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
}

// ── Tic-Tac-Toe ───────────────────────────────────────────────────
export type Board = (string | null)[];
export type TicTacToeStatus = 'idle' | 'active' | 'finished';

export interface TicTacToeGame {
  gameId: string;
  board: Board;
  currentPlayer: 'X' | 'O';
  status: 'active' | 'finished';
  winner: string | null;
}

// ── Guess Number ─────────────────────────────────────────────────
export type GuessHint = 'too-low' | 'too-high' | 'correct';

export interface GuessEntry {
  value: number;
  hint: GuessHint;
}

export interface GuessNumberGame {
  gameId: string;
  status: 'active' | 'won' | 'lost';
  attempts: number;
  maxAttempts: number;
  guesses: GuessEntry[];
  attemptsLeft?: number;
  hint?: string;
}

// ── Generic API wrapper ───────────────────────────────────────────
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

// ── Axios error response body ─────────────────────────────────────
// Used to safely narrow error.response.data in catch blocks.
export interface ApiErrorBody {
  error?: string;
  message?: string;
  success: false;
}
