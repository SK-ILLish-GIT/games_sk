import type { Difficulty, LetterFeedback } from '../game/engine';

// ── A single guess record stored in a session ─────────────────────
// `kind` distinguishes between letter and full-word guesses.
// Persisted records carry only the raw inputs — feedback is derived from the
// secret word at response time and attached as `DecoratedGuessRecord`.
export interface GuessRecord {
  kind:      'letter' | 'word';
  value:     string;
  correct:   boolean;
  timestamp: string;
}

export type DecoratedLetterRecord = GuessRecord & { kind: 'letter'; feedback: LetterFeedback };
export type DecoratedWordRecord   = GuessRecord & { kind: 'word' };
export type DecoratedGuessRecord  = DecoratedLetterRecord | DecoratedWordRecord;

// ── Full in-memory / Redis game state (excludes MongoDB _id) ──────
// `word` is the secret and is never sent to the client while the game is active.
export interface GameState {
  gameId:         string;
  word:           string;
  difficulty:     Difficulty;
  guessedLetters: string[];
  wrongGuesses:   number;
  maxWrong:       number;
  guesses:        GuessRecord[];
  status:         'active' | 'won' | 'lost';
  playerId:       string;
  playerName:     string;
  createdAt:      string;
  finishedAt?:    string;
}

// ── Client-safe view (word stripped while active) ─────────────────
// Guesses are decorated with feedback derived from the secret word.
export type SafeGameState = Omit<GameState, 'word' | 'guesses'> & {
  maskedWord: string;
  word?:      string;                  // only included once the game is finished
  guesses:    DecoratedGuessRecord[];
};

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
