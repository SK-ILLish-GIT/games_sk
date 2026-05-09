// ── Standard HTTP status codes ────────────────────────────────────
export const HTTP_STATUS = {
  OK:                  200,
  CREATED:             201,
  BAD_REQUEST:         400,
  UNAUTHORIZED:        401,
  FORBIDDEN:           403,
  NOT_FOUND:           404,
  CONFLICT:            409,
  SERVER_ERROR:        500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ── User roles ────────────────────────────────────────────────────
// Mirrors the UserRole enum from shared-types but as a const
// for use in Prisma calls where enum values don't apply.
export const ROLE = {
  Player: 'player',
  Admin:  'admin',
} as const;

// ── Redis key helpers ─────────────────────────────────────────────
export const REDIS_KEY_PREFIX = {
  REFRESH_TOKEN: 'refresh',
} as const;

/** Builds the Redis key for a refresh token hash */
export const refreshTokenKey = (hash: string) => `${REDIS_KEY_PREFIX.REFRESH_TOKEN}:${hash}`;
