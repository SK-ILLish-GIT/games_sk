// ── Frontend-local game enums ──────────────────────────────────────
// These mirror the shared-types enums without requiring the package to be
// linked/bundled into the Vite frontend build.

/** User roles in the system */
export enum UserRole {
  Player = 'player',
  Admin  = 'admin',
}

/** Tic-Tac-Toe game status as returned by the API */
export enum TicTacToeStatus {
  Active   = 'active',
  Finished = 'finished',
}

/** Local UI state for the TicTacToe page (includes pre-game idle state) */
export enum TicTacToeUIStatus {
  Idle     = 'idle',
  Active   = 'active',
  Finished = 'finished',
}

/** Guess-number game status as returned by the API */
export enum GuessStatus {
  Active = 'active',
  Won    = 'won',
  Lost   = 'lost',
}

/** Hint values returned after each guess */
export enum Hint {
  TooLow  = 'too-low',
  TooHigh = 'too-high',
  Correct = 'correct',
}

/** Hangman game status as returned by the API */
export enum HangmanStatus {
  Active = 'active',
  Won    = 'won',
  Lost   = 'lost',
}

/** Hangman difficulty levels */
export enum HangmanDifficulty {
  Easy   = 'easy',
  Medium = 'medium',
  Hard   = 'hard',
}

/** Known game IDs used in API routes */
export enum GameId {
  TicTacToe   = 'tic-tac-toe',
  GuessNumber = 'guess-number',
  Hangman     = 'hangman',
  FlappyBird  = 'flappy-bird',
}

/** Flappy Bird game modes */
export enum FlappyMode {
  Endless     = 'endless',
  TimeAttack  = 'time-attack',
  GravityFlip = 'gravity-flip',
  Reverse     = 'reverse',
  Chaos       = 'chaos',
  DailySeed   = 'daily-seed',
}

/** Flappy Bird run status returned by the API */
export enum FlappyStatus {
  Active   = 'active',
  Finished = 'finished',
  Rejected = 'rejected',
}
