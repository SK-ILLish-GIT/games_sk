/** Hint values returned after each guess */
export enum Hint {
  TooLow  = 'too-low',
  TooHigh = 'too-high',
  Correct = 'correct',
}

export interface GuessResult {
  hint: Hint;
  won:  boolean;
  lost: boolean;
}

export function generateSecret(min = 1, max = 100): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function evaluateGuess(secret: number, guess: number): Hint {
  if (guess < secret) return Hint.TooLow;
  if (guess > secret) return Hint.TooHigh;
  return Hint.Correct;
}

/**
 * Score formula: base 100, minus 15 per wasted attempt.
 * Perfect (1st guess): 100. 7th guess win: 10. Loss: 0.
 */
export function calculateScore(attempts: number, won: boolean): number {
  if (!won) return 0;
  return Math.max(10, 100 - (attempts - 1) * 15);
}
