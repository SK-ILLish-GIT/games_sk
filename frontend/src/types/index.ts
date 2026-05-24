import { UserRole, TicTacToeUIStatus, TicTacToeStatus, GuessStatus, Hint, HangmanStatus, HangmanDifficulty, FlappyMode, FlappyStatus } from '../enums/game.enum';
export { UserRole, GuessStatus, Hint, HangmanStatus, HangmanDifficulty, FlappyMode, FlappyStatus } from '../enums/game.enum';
export interface User {
  id: string;
  username: string;
  role: UserRole;
  email?: string;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
}

// ── Auth Context contract ─────────────────────────────────────────
export interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: UpdateUserRequest) => Promise<void>;
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

// ── Hangman ──────────────────────────────────────────────────────
export type HangmanPositionStatus = 'correct' | 'present' | 'absent';

export interface HangmanLetterFeedback {
  occurrences: number;
  positions:   number[];
}

export interface HangmanWordFeedback {
  perPosition:      HangmanPositionStatus[];
  correctPositions: number;
  presentLetters:   number;
}

export interface HangmanLetterGuess {
  kind:      'letter';
  value:     string;
  correct:   boolean;
  feedback:  HangmanLetterFeedback;
  timestamp?: string;
}

export interface HangmanWordGuess {
  kind:      'word';
  value:     string;
  correct:   boolean;
  feedback:  HangmanWordFeedback;
  timestamp?: string;
}

export type HangmanGuessRecord = HangmanLetterGuess | HangmanWordGuess;

export interface HangmanGame {
  gameId:         string;
  status:         HangmanStatus;
  difficulty:     HangmanDifficulty;
  maskedWord:     string;
  word?:          string;        // only present once the game has finished
  guessedLetters: string[];
  wrongGuesses:   number;
  maxWrong:       number;
  guesses:        HangmanGuessRecord[];
  lastGuess?:     HangmanGuessRecord;
  attemptsLeft?:  number;
}

// ── Flappy Bird ──────────────────────────────────────────────────
export interface FlappyPhysics {
  gravity:      number;
  jumpVel:      number;
  pipeGap:      number;
  pipeSpeed:    number;
  pipeInterval: number;
}

export interface FlappyCosmetics {
  skin:       string;
  pipe:       string;
  background: string;
  trail:      string;
  audio:      string;
}

export interface FlappyModeDefinition {
  id:              FlappyMode;
  label:           string;
  description:     string;
  physics:         FlappyPhysics;
  scoreMultiplier: number;
  durationCapSec:  number | null;
}

export interface FlappyCosmeticOption {
  id:    string;
  label: string;
  emoji: string;
}

export interface FlappyUnlockRule {
  cosmetic: string;
  category: 'skin' | 'pipe' | 'background' | 'trail' | 'audio';
  minScore: number;
  label:    string;
  emoji:    string;
}

export interface FlappyConfig {
  modes:          FlappyModeDefinition[];
  cosmetics: {
    skins:       readonly FlappyCosmeticOption[];
    pipes:       readonly FlappyCosmeticOption[];
    backgrounds: readonly FlappyCosmeticOption[];
    trails:      readonly FlappyCosmeticOption[];
    audio:       readonly FlappyCosmeticOption[];
  };
  unlockRules:    FlappyUnlockRule[];
  defaultLoadout: FlappyCosmetics;
}

export interface FlappyStartResponse {
  gameId:         string;
  mode:           FlappyMode;
  seed:           number;
  physics:        FlappyPhysics;
  cosmetics:      FlappyCosmetics;
  signature:      string;
  startedAt:      string;
  durationCapSec: number | null;
}

export interface FlappyFinishResponse {
  gameId:       string;
  mode:         FlappyMode;
  score:        number;
  rawScore:     number;
  distance:     number;
  jumps:        number;
  durationMs:   number;
  newHighScore: boolean;
  unlocks:      FlappyUnlockRule[];
}

export interface FlappyProfileResponse {
  playerId:           string;
  playerName:         string;
  unlockedSkins:      string[];
  unlockedPipes:      string[];
  unlockedBackgrounds: string[];
  unlockedTrails:     string[];
  unlockedAudio:      string[];
  selected:           FlappyCosmetics;
  highScores:         Record<string, number>;
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
