import type { Request } from 'express';

// ── JWT payload attached to Express requests after auth ───────────
export interface JwtUserPayload {
  sub: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

// ── Augment Express Request to carry typed `user` ─────────────────
// Avoids all `(req as any).user` casts in controllers/middleware.
export interface AuthenticatedRequest extends Request {
  user: JwtUserPayload;
}

// ── HTTP error shape thrown by controllers ─────────────────────────
export interface HttpError extends Error {
  status?: number;
  code?: string;
}
