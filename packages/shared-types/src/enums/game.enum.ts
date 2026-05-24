// ── Cross-cutting game enums shared across all services and the frontend ──────

/** Registered game identifiers — used as gameId in leaderboard and score submissions */
export enum GameId {
  TicTacToe  = 'tic-tac-toe',
  GuessNumber = 'guess-number',
  Hangman    = 'hangman',
  FlappyBird = 'flappy-bird',
}

/** Flappy Bird game modes — each has its own physics catalogue and scoring cap */
export enum FlappyMode {
  Endless     = 'endless',
  TimeAttack  = 'time-attack',
  GravityFlip = 'gravity-flip',
  Reverse     = 'reverse',
  Chaos       = 'chaos',
  DailySeed   = 'daily-seed',
}

/** Flappy Bird run status as returned by the API */
export enum FlappyStatus {
  Active   = 'active',
  Finished = 'finished',
  Rejected = 'rejected',
}

/** Roles that can be assigned to a user */
export enum UserRole {
  Player = 'player',
  Admin  = 'admin',
}

/** Service health check status values */
export enum HealthStatus {
  Ok      = 'ok',
  Degraded = 'degraded',
}
