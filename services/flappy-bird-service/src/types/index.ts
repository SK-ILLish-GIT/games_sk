import type { FlappyMode, PhysicsSettings, CosmeticLoadout } from '../game/engine';

// ── Persisted session document shape (matches Mongoose model) ─────
export interface FlappySessionState {
  gameId:      string;
  mode:        FlappyMode;
  seed:        number;
  physics:     PhysicsSettings;
  cosmetics:   CosmeticLoadout;
  signature:   string;          // HMAC over (gameId|seed|mode|playerId|startedAt)
  status:      'active' | 'finished' | 'rejected';
  score:       number;          // server-validated leaderboard score
  rawScore:    number;          // unscaled client score
  distance:    number;          // pipes' worth of horizontal travel
  jumps:       number;
  durationMs:  number;
  rejectReason?: string;
  playerId:    string;
  playerName:  string;
  startedAt:   string;
  finishedAt?: string;
}

// ── Player loadout / unlocks document shape ───────────────────────
export interface FlappyProfileState {
  playerId:           string;
  playerName:         string;
  unlockedSkins:      string[];
  unlockedPipes:      string[];
  unlockedBackgrounds: string[];
  unlockedTrails:     string[];
  unlockedAudio:      string[];
  selected:           CosmeticLoadout;
  highScores:         Record<string, number>; // keyed by FlappyMode
  updatedAt:          string;
}

// ── HTTP error shape forwarded to global error handler ───────────
export interface HttpError extends Error {
  status?: number;
  code?:   string;
}

// ── JWT payload extracted from Bearer token ───────────────────────
export interface JwtUserPayload {
  sub:      string;
  username: string;
  role?:    string;
  iat?:     number;
  exp?:     number;
}

// ── Client-facing payloads ────────────────────────────────────────
export interface CreateGameBody {
  mode?:      string;
  settings?:  Partial<PhysicsSettings>;
  cosmetics?: Partial<CosmeticLoadout>;
}

export interface FinishGameBody {
  score:      unknown;
  distance:   unknown;
  jumps:      unknown;
  durationMs: unknown;
  signature?: unknown;
}
