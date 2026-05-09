import { UserRole, TicTacToeUIStatus, TicTacToeStatus, GuessStatus, Hint } from '../enums/game.enum';
export { UserRole, GuessStatus, Hint } from '../enums/game.enum';
export interface User {
  id: string;
  username: string;
  role: UserRole;
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
// Re-exported from enums for convenience
// TicTacToeStatus is the API status; TicTacToeUIStatus adds the 'idle' state for local UI
export type { TicTacToeStatus } from '../enums/game.enum';

export interface TicTacToeGame {
  gameId: string;
  board: Board;
  currentPlayer: 'X' | 'O';
  status: TicTacToeStatus;
  winner: string | null;
}

// ── Guess Number ─────────────────────────────────────────────────
// GuessHint is re-exported as Hint for backwards compat; use Hint going forward
export type GuessHint = Hint;

export interface GuessEntry {
  value: number;
  hint: Hint;
}

export interface GuessNumberGame {
  gameId: string;
  status: GuessStatus;
  attempts: number;
  maxAttempts: number;
  guesses: GuessEntry[];
  attemptsLeft?: number;
  hint?: Hint;
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
