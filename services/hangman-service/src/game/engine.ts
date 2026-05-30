// Pure game logic — no I/O, fully testable.
import randomWords from 'random-words';

import { DIFFICULTY_MULTIPLIER } from '../constants/game.constants';
import { FALLBACK_WORDS, LENGTH_RANGE, type Difficulty } from './words';

export type { Difficulty } from './words';

export enum HangmanStatus {
  Active = 'active',
  Won    = 'won',
  Lost   = 'lost',
}

// ── Per-guess feedback shapes ────────────────────────────────────
export interface LetterFeedback {
  occurrences: number;     // how many times the letter appears in the secret
  positions:   number[];   // 0-indexed positions where it appears
}

export interface GuessResult {
  correct:      boolean;
  alreadyTried: boolean;
  status:       HangmanStatus;
}

const LETTER_RE = /^[a-z]$/;
const WORD_RE   = /^[a-z]+$/;
const PICK_RETRIES = 25;

/**
 * Pulls a random English word from the `random-words` generator (~1.9k common
 * words baked in — no network call) and rejects until one falls inside the
 * requested length window. Falls back to a tiny inline list if the generator
 * exhausts its retries without a hit, so word generation never throws.
 */
export function pickWord(difficulty: Difficulty): string {
  const [min, max] = LENGTH_RANGE[difficulty];
  for (let i = 0; i < PICK_RETRIES; i++) {
    const candidate = String(randomWords()).toLowerCase();
    if (WORD_RE.test(candidate) && candidate.length >= min && candidate.length <= max) {
      return candidate;
    }
  }
  const pool = FALLBACK_WORDS[difficulty];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Validates and normalises a difficulty input from the client. */
export function normaliseDifficulty(value: unknown): Difficulty {
  if (value === 'easy' || value === 'medium' || value === 'hard') return value;
  return 'medium';
}

/** Validates a single letter guess. Throws on bad input. */
export function normaliseLetter(value: unknown): string {
  if (typeof value !== 'string') throw new Error('letter must be a string');
  const lower = value.trim().toLowerCase();
  if (!LETTER_RE.test(lower)) throw new Error('letter must be a single A-Z character');
  return lower;
}

/** Returns the masked view of the word: revealed letters or "_". */
export function maskWord(word: string, guessedLetters: readonly string[]): string {
  const set = new Set(guessedLetters);
  return word
    .split('')
    .map((ch) => (set.has(ch) ? ch : '_'))
    .join('');
}

/** True when every letter in the word has been guessed. */
export function isWordRevealed(word: string, guessedLetters: readonly string[]): boolean {
  const set = new Set(guessedLetters);
  return word.split('').every((ch) => set.has(ch));
}

/** Counts and locates a letter inside the secret word. */
export function letterFeedback(word: string, letter: string): LetterFeedback {
  const positions: number[] = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] === letter) positions.push(i);
  }
  return { occurrences: positions.length, positions };
}

/** Applies a single-letter guess. Pure: returns the new field deltas. */
export function applyLetterGuess(
  word: string,
  guessedLetters: readonly string[],
  wrongGuesses: number,
  maxWrong: number,
  letter: string,
): { guessedLetters: string[]; wrongGuesses: number; result: GuessResult } {
  const next = [...guessedLetters];
  if (next.includes(letter)) {
    return {
      guessedLetters: next,
      wrongGuesses,
      result: { correct: word.includes(letter), alreadyTried: true, status: HangmanStatus.Active },
    };
  }
  next.push(letter);
  const correct = word.includes(letter);
  const newWrong = wrongGuesses + (correct ? 0 : 1);
  const won  = correct && isWordRevealed(word, next);
  const lost = !won && newWrong >= maxWrong;
  const status = won ? HangmanStatus.Won : lost ? HangmanStatus.Lost : HangmanStatus.Active;
  return {
    guessedLetters: next,
    wrongGuesses: newWrong,
    result: { correct, alreadyTried: false, status },
  };
}

/**
 * Score formula: base 100, minus 10 per wrong guess, scaled by difficulty.
 * Win floor: 10. Loss: 0.
 */
export function calculateScore(wrongGuesses: number, difficulty: Difficulty, won: boolean): number {
  if (!won) return 0;
  const base = 100 - wrongGuesses * 10;
  const multiplier = DIFFICULTY_MULTIPLIER[difficulty];
  return Math.max(10, Math.round(base * multiplier));
}
