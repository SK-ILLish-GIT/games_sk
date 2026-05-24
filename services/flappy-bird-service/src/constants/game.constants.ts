// ── Standard HTTP status codes ────────────────────────────────────
export const HTTP_STATUS = {
  OK:                   200,
  CREATED:              201,
  BAD_REQUEST:          400,
  UNAUTHORIZED:         401,
  NOT_FOUND:            404,
  UNPROCESSABLE_ENTITY: 422,
  SERVER_ERROR:         500,
  SERVICE_UNAVAILABLE:  503,
} as const;

// ── Anonymous / guest player defaults ─────────────────────────────
export const ANONYMOUS_PLAYER  = 'anonymous' as const;
export const GUEST_PLAYER_NAME = 'Guest'     as const;

// ── Redis key helpers ─────────────────────────────────────────────
export const REDIS_KEY_PREFIX = {
  GAME:        'game:flappy',
  DAILY_SEED:  'flappy:daily-seed',
} as const;

// ── Run validation thresholds ─────────────────────────────────────
// Server-side ceiling factors to spot-check submitted runs.
// All factors are intentionally generous; we only reject obvious forgeries.
export const RUN_VALIDATION = {
  // Allow 10% slack over the mode's theoretical max scoring rate.
  scoreSlack:     1.1,
  // Bird can flap at most ~8 times per second under normal play.
  maxFlapsPerSec: 8,
  // Pipe distance should match elapsed time within ±15%.
  distanceSlack:  0.15,
} as const;
