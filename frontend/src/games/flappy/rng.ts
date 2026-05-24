// Mulberry32: fast, deterministic 32-bit PRNG.
// We use a seeded RNG so the client-side level generation matches the
// server-issued seed — required for the daily-seed mode and useful for
// reproducible bug reports.

export function createRng(seed: number) {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}
