// ── Prisma groupBy result shape for score aggregation ─────────────
export interface ScoreGroupByResult {
  userId: string;
  username: string;
  _max: { score: number | null };
}

// ── HTTP error shape forwarded to global error handler ───────────
export interface HttpError extends Error {
  status?: number;
  code?: string;
}
