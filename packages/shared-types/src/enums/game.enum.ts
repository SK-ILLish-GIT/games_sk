// ── Cross-cutting game enums shared across all services and the frontend ──────

/** Registered game identifiers — used as gameId in leaderboard and score submissions */
export enum GameId {
  TicTacToe  = 'tic-tac-toe',
  GuessNumber = 'guess-number',
  Hangman    = 'hangman',
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
