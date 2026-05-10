// ── Standard HTTP status codes ────────────────────────────────────
export const HTTP_STATUS = {
  OK:                  200,
  CREATED:             201,
  BAD_REQUEST:         400,
  UNAUTHORIZED:        401,
  NOT_FOUND:           404,
  SERVER_ERROR:        500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ── Anonymous / guest player defaults ─────────────────────────────
export const ANONYMOUS_PLAYER    = 'anonymous' as const;
export const GUEST_PLAYER_NAME   = 'Guest'     as const;

// ── Redis key helpers ─────────────────────────────────────────────
export const REDIS_KEY_PREFIX = {
  GAME: 'game:hangman',
} as const;

// ── Difficulty multipliers applied to the win score ──────────────
export const DIFFICULTY_MULTIPLIER = {
  easy:   1.0,
  medium: 1.5,
  hard:   2.0,
} as const;
