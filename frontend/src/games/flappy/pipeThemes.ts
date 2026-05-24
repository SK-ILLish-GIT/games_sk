// Pipe theme renderer. Each theme supplies two CanvasGradient builders
// (one for top pipes, one for bottom) and an optional cap colour.

export interface PipeTheme {
  id:      string;
  fill:    (ctx: CanvasRenderingContext2D, x: number, w: number) => CanvasGradient | string;
  capFill: string;
  edge:    string;
  glow?:   string;
}

export const PIPE_THEMES: Record<string, PipeTheme> = {
  'classic-green': {
    id: 'classic-green',
    fill: (ctx, x, w) => {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, '#1f7a3a'); g.addColorStop(0.5, '#3fbf5b'); g.addColorStop(1, '#1f7a3a');
      return g;
    },
    capFill: '#15532a',
    edge:    '#0a3d1a',
  },
  neon: {
    id: 'neon',
    fill: (ctx, x, w) => {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, '#0aff9d'); g.addColorStop(0.5, '#a4ff6b'); g.addColorStop(1, '#0aff9d');
      return g;
    },
    capFill: '#10403f',
    edge:    '#0c4e3c',
    glow:    '#0aff9d',
  },
  candy: {
    id: 'candy',
    fill: (ctx, x, w) => {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, '#ff79c6'); g.addColorStop(0.5, '#ffd1f1'); g.addColorStop(1, '#ff79c6');
      return g;
    },
    capFill: '#c44390',
    edge:    '#9b2870',
  },
  lava: {
    id: 'lava',
    fill: (ctx, x, w) => {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, '#7a1818'); g.addColorStop(0.5, '#ff5a1f'); g.addColorStop(1, '#7a1818');
      return g;
    },
    capFill: '#3d0e0e',
    edge:    '#220707',
    glow:    '#ff5a1f',
  },
  ice: {
    id: 'ice',
    fill: (ctx, x, w) => {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, '#7fc8ff'); g.addColorStop(0.5, '#dff3ff'); g.addColorStop(1, '#7fc8ff');
      return g;
    },
    capFill: '#3a86b8',
    edge:    '#1f5a86',
  },
  glass: {
    id: 'glass',
    fill: () => 'rgba(180, 220, 255, 0.35)',
    capFill: 'rgba(180, 220, 255, 0.6)',
    edge:    'rgba(255, 255, 255, 0.6)',
  },
  cactus: {
    id: 'cactus',
    fill: (ctx, x, w) => {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, '#2d6a4f'); g.addColorStop(0.5, '#52b788'); g.addColorStop(1, '#2d6a4f');
      return g;
    },
    capFill: '#1b4332',
    edge:    '#081c15',
  },
};

export function getPipeTheme(id: string): PipeTheme {
  return PIPE_THEMES[id] ?? PIPE_THEMES['classic-green'];
}

export function drawPipe(
  ctx: CanvasRenderingContext2D,
  theme: PipeTheme,
  x: number,
  y: number,
  w: number,
  h: number,
  facingDown: boolean,
): void {
  const capH = 22;
  ctx.save();
  if (theme.glow) {
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur  = 12;
  }
  ctx.fillStyle = theme.fill(ctx, x, w);
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur = 0;
  ctx.fillStyle = theme.capFill;
  if (facingDown) {
    ctx.fillRect(x - 4, y + h - capH, w + 8, capH);
  } else {
    ctx.fillRect(x - 4, y, w + 8, capH);
  }
  ctx.strokeStyle = theme.edge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}
