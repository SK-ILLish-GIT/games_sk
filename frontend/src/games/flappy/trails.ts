// Particle-trail emitter. Each frame the bird may emit one particle; the
// trail itself owns its full lifecycle (spawn → fade → reap).

export interface Particle {
  x:     number;
  y:     number;
  vx:    number;
  vy:    number;
  life:  number;   // remaining seconds
  age:   number;   // elapsed seconds since spawn
  size:  number;
  color: string;
  trail: string;
}

export interface TrailDefinition {
  id:        string;
  spawnRate: number;            // particles per second
  spawn:     (x: number, y: number, rng: () => number) => Particle;
  draw:      (ctx: CanvasRenderingContext2D, p: Particle) => void;
}

function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x; }

const noneTrail: TrailDefinition = {
  id: 'none',
  spawnRate: 0,
  spawn: () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, age: 0, size: 0, color: '', trail: 'none' }),
  draw: () => {/* noop */},
};

const flameTrail: TrailDefinition = {
  id: 'flame',
  spawnRate: 40,
  spawn: (x, y, rng) => ({
    x: x - 8, y: y + (rng() - 0.5) * 4,
    vx: -60 - rng() * 40, vy: (rng() - 0.5) * 30,
    life: 0.5, age: 0, size: 6 + rng() * 4,
    color: rng() < 0.5 ? '#ffd166' : '#f76d10',
    trail: 'flame',
  }),
  draw: (ctx, p) => {
    const a = 1 - clamp01(p.age / p.life);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  },
};

const sparklesTrail: TrailDefinition = {
  id: 'sparkles',
  spawnRate: 30,
  spawn: (x, y, rng) => ({
    x: x - 4 + (rng() - 0.5) * 8, y: y + (rng() - 0.5) * 8,
    vx: -20, vy: (rng() - 0.5) * 20,
    life: 0.7, age: 0, size: 2 + rng() * 2,
    color: ['#ffd166', '#f76d10', '#ff79c6', '#a3e1ff'][Math.floor(rng() * 4)],
    trail: 'sparkles',
  }),
  draw: (ctx, p) => {
    const a = 1 - clamp01(p.age / p.life);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = a;
    ctx.fillRect(p.x - p.size, p.y - 0.5, p.size * 2, 1);
    ctx.fillRect(p.x - 0.5, p.y - p.size, 1, p.size * 2);
    ctx.globalAlpha = 1;
  },
};

const rainbowTrail: TrailDefinition = {
  id: 'rainbow',
  spawnRate: 50,
  spawn: (x, y, rng) => ({
    x: x - 6, y,
    vx: -40, vy: 0,
    life: 0.4, age: 0, size: 5,
    color: `hsl(${(performance.now() / 4) % 360}, 100%, 60%)`,
    trail: 'rainbow',
  }),
  draw: (ctx, p) => {
    const a = 1 - clamp01(p.age / p.life);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  },
};

const smokeTrail: TrailDefinition = {
  id: 'smoke',
  spawnRate: 18,
  spawn: (x, y, rng) => ({
    x: x - 6, y,
    vx: -20 - rng() * 10, vy: -8 - rng() * 12,
    life: 1.2, age: 0, size: 4 + rng() * 2,
    color: '#888',
    trail: 'smoke',
  }),
  draw: (ctx, p) => {
    const a = (1 - clamp01(p.age / p.life)) * 0.5;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size + p.age * 8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  },
};

const bubbleTrail: TrailDefinition = {
  id: 'bubble',
  spawnRate: 12,
  spawn: (x, y, rng) => ({
    x: x - 6, y,
    vx: -15, vy: -20 - rng() * 30,
    life: 1.4, age: 0, size: 3 + rng() * 3,
    color: 'rgba(255,255,255,0.85)',
    trail: 'bubble',
  }),
  draw: (ctx, p) => {
    const a = (1 - clamp01(p.age / p.life)) * 0.9;
    ctx.strokeStyle = p.color;
    ctx.globalAlpha = a;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  },
};

export const TRAILS: Record<string, TrailDefinition> = {
  none:     noneTrail,
  flame:    flameTrail,
  sparkles: sparklesTrail,
  rainbow:  rainbowTrail,
  smoke:    smokeTrail,
  bubble:   bubbleTrail,
};

export function getTrail(id: string): TrailDefinition {
  return TRAILS[id] ?? noneTrail;
}
