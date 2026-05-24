// Client-side game engine. Pure functions over a `GameState` object so the
// render loop stays predictable and the engine can be reasoned about
// (and unit-tested) without touching the canvas.

import type { FlappyPhysics } from '../../types';
import { FlappyMode } from '../../enums/game.enum';
import { createRng, rngRange } from './rng';
import { getTrail, type Particle, type TrailDefinition } from './trails';

export const CANVAS_WIDTH  = 640;
export const CANVAS_HEIGHT = 500;
export const BIRD_X        = 130;
export const BIRD_RADIUS   = 14;
export const PIPE_WIDTH    = 60;
export const GROUND_HEIGHT = 56;

export interface Pipe {
  id:       number;
  x:        number;
  gapY:     number;       // centre of the gap
  gap:      number;       // mode-specific gap height (can vary in chaos mode)
  scored:   boolean;
  modifier: PipeModifier;
}

export type PipeModifier = 'none' | 'narrow' | 'wide' | 'wobble' | 'inverted';

export interface GameState {
  // configuration (immutable per run)
  physics:  FlappyPhysics;
  mode:     FlappyMode;
  rng:      () => number;
  trail:    TrailDefinition;
  trailId:  string;

  // simulation state
  bird: {
    y:        number;
    vy:       number;
    rotation: number;
    flap:     number;       // 0..1 wing phase
  };
  pipes:     Pipe[];
  particles: Particle[];
  gravityDir: 1 | -1;       // for gravity-flip mode
  pipesSinceFlip: number;
  spawnTimer: number;
  nextPipeId: number;
  elapsed:    number;       // seconds
  distance:   number;       // pixels travelled
  score:      number;
  jumps:      number;
  status:     'ready' | 'playing' | 'over';
  endReason:  '' | 'ceiling' | 'ground' | 'pipe' | 'timeout';
}

export interface FlapResult {
  jumped: boolean;
}

export interface CreateOptions {
  physics: FlappyPhysics;
  mode:    FlappyMode;
  seed:    number;
  trailId: string;
}

export function createState({ physics, mode, seed, trailId }: CreateOptions): GameState {
  return {
    physics,
    mode,
    rng:     createRng(seed),
    trail:   getTrail(trailId),
    trailId,
    bird: {
      y:        CANVAS_HEIGHT / 2,
      vy:       0,
      rotation: 0,
      flap:     0,
    },
    pipes:     [],
    particles: [],
    gravityDir: 1,
    pipesSinceFlip: 0,
    spawnTimer: 0.6,        // small grace period before first pipe
    nextPipeId: 1,
    elapsed:    0,
    distance:   0,
    score:      0,
    jumps:      0,
    status:     'ready',
    endReason:  '',
  };
}

export function flap(state: GameState): FlapResult {
  if (state.status === 'over') return { jumped: false };
  // First flap starts the run.
  if (state.status === 'ready') state.status = 'playing';
  state.bird.vy = state.physics.jumpVel * state.gravityDir;
  state.bird.flap = 0;
  state.jumps += 1;
  return { jumped: true };
}

function spawnPipe(state: GameState): void {
  const minCentre = 100;
  const maxCentre = CANVAS_HEIGHT - GROUND_HEIGHT - 100;
  const gapY = rngRange(state.rng, minCentre, maxCentre);
  let modifier: PipeModifier = 'none';
  let gap = state.physics.pipeGap;

  if (state.mode === FlappyMode.Chaos) {
    const r = state.rng();
    if      (r < 0.18) { modifier = 'narrow';   gap = Math.max(110, gap - 30); }
    else if (r < 0.32) { modifier = 'wide';     gap = gap + 30; }
    else if (r < 0.48) { modifier = 'wobble'; }
    else if (r < 0.55) { modifier = 'inverted'; }
  }

  state.pipes.push({
    id:       state.nextPipeId++,
    x:        state.mode === FlappyMode.Reverse ? -PIPE_WIDTH : CANVAS_WIDTH,
    gapY,
    gap,
    scored:   false,
    modifier,
  });
}

function maybeFlipGravity(state: GameState): void {
  if (state.mode !== FlappyMode.GravityFlip) return;
  if (state.pipesSinceFlip < 5) return;
  state.gravityDir = (state.gravityDir === 1 ? -1 : 1) as 1 | -1;
  state.pipesSinceFlip = 0;
}

function emitTrail(state: GameState, dt: number): void {
  const rate = state.trail.spawnRate;
  if (rate <= 0) return;
  state.spawnTimer ??= 0;
  // Use a deterministic accumulator on the rng so particle density is stable.
  const expected = rate * dt;
  let n = Math.floor(expected);
  if (state.rng() < expected - n) n += 1;
  for (let i = 0; i < n; i++) {
    state.particles.push(state.trail.spawn(BIRD_X, state.bird.y, state.rng));
  }
}

function updateParticles(state: GameState, dt: number): void {
  for (const p of state.particles) {
    p.x   += p.vx * dt;
    p.y   += p.vy * dt;
    p.age += dt;
  }
  state.particles = state.particles.filter(p => p.age < p.life);
}

function rectCircleCollide(rx: number, ry: number, rw: number, rh: number, cx: number, cy: number, cr: number): boolean {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < cr * cr;
}

function checkPipeCollisions(state: GameState): boolean {
  for (const p of state.pipes) {
    if (p.x + PIPE_WIDTH < BIRD_X - BIRD_RADIUS) continue;
    if (p.x > BIRD_X + BIRD_RADIUS) break; // sorted left→right is not guaranteed in reverse, but cheap to check
    const topH    = p.gapY - p.gap / 2;
    const bottomY = p.gapY + p.gap / 2;
    const bottomH = CANVAS_HEIGHT - GROUND_HEIGHT - bottomY;
    if (rectCircleCollide(p.x, 0, PIPE_WIDTH, topH, BIRD_X, state.bird.y, BIRD_RADIUS)) return true;
    if (rectCircleCollide(p.x, bottomY, PIPE_WIDTH, bottomH, BIRD_X, state.bird.y, BIRD_RADIUS)) return true;
  }
  return false;
}

export function tick(state: GameState, dt: number): void {
  if (state.status !== 'playing') {
    state.bird.flap = (state.bird.flap + dt * 2) % 1;
    return;
  }

  state.elapsed += dt;

  // Wobble modifier nudges any active wobble pipe's gap up/down.
  for (const p of state.pipes) {
    if (p.modifier === 'wobble') {
      p.gapY += Math.sin((state.elapsed + p.id) * 4) * 40 * dt;
    }
  }

  // Bird physics
  state.bird.vy += state.physics.gravity * state.gravityDir * dt;
  state.bird.y  += state.bird.vy * dt;
  state.bird.rotation = Math.atan2(state.bird.vy, 400);
  state.bird.flap = (state.bird.flap + dt * (1 + Math.abs(state.bird.vy) / 600)) % 1;

  // Pipe scrolling
  const direction = state.mode === FlappyMode.Reverse ? 1 : -1;
  for (const p of state.pipes) {
    p.x += state.physics.pipeSpeed * direction * dt;
  }
  state.distance += state.physics.pipeSpeed * dt;

  // Spawn
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnPipe(state);
    state.spawnTimer = state.physics.pipeInterval;
  }

  // Score (when pipe centre crosses the bird's x)
  for (const p of state.pipes) {
    if (p.scored) continue;
    const crossed = state.mode === FlappyMode.Reverse
      ? p.x > BIRD_X + PIPE_WIDTH
      : p.x + PIPE_WIDTH < BIRD_X;
    if (crossed) {
      p.scored = true;
      state.score += 1;
      state.pipesSinceFlip += 1;
      maybeFlipGravity(state);
    }
  }

  // Reap off-screen pipes
  state.pipes = state.pipes.filter(p =>
    state.mode === FlappyMode.Reverse
      ? p.x < CANVAS_WIDTH + 60
      : p.x + PIPE_WIDTH > -60,
  );

  emitTrail(state, dt);
  updateParticles(state, dt);

  // Boundary / pipe collisions end the run.
  if (state.bird.y - BIRD_RADIUS < 0) {
    state.status = 'over'; state.endReason = 'ceiling';
  } else if (state.bird.y + BIRD_RADIUS > CANVAS_HEIGHT - GROUND_HEIGHT) {
    state.status = 'over'; state.endReason = 'ground';
  } else if (checkPipeCollisions(state)) {
    state.status = 'over'; state.endReason = 'pipe';
  }
}

export function timeAttackOver(state: GameState, durationCapSec: number | null): boolean {
  if (!durationCapSec) return false;
  if (state.elapsed >= durationCapSec) {
    state.status = 'over';
    state.endReason = 'timeout';
    return true;
  }
  return false;
}
