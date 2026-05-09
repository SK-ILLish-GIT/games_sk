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

// ── Redis sorted-set key helpers ──────────────────────────────────
export const REDIS_KEY_PREFIX = {
  LEADERBOARD: 'leaderboard',
  GLOBAL:      'leaderboard:global',
} as const;
