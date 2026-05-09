import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/token.service';
import type { AuthenticatedRequest } from '../types';

// Validates the Bearer JWT and attaches the decoded payload to `req.user`
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    // Expired or tampered token — not logged since it's an expected client condition
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

// Guards a route to users with a specific role (e.g. 'admin')
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user || authReq.user.role !== role) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }
    next();
  };
}
