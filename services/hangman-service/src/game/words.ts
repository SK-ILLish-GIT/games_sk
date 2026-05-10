// Defensive fallback list — used only if the `random-words` generator fails
// to produce a candidate within the difficulty length window after several
// retries. Kept intentionally tiny: the generator is the source of truth.
export type Difficulty = 'easy' | 'medium' | 'hard';

export const FALLBACK_WORDS: Record<Difficulty, readonly string[]> = {
  easy:   ['rain', 'cake', 'bird', 'tree', 'lion'],
  medium: ['planet', 'rocket', 'forest', 'engine', 'jacket'],
  hard:   ['elephant', 'umbrella', 'butterfly', 'discovery', 'crocodile'],
};

export const LENGTH_RANGE: Record<Difficulty, readonly [number, number]> = {
  easy:   [4, 5],
  medium: [6, 7],
  hard:   [8, 12],
};
