// Background renderers. Each fills the entire canvas with a themed scene
// and accepts a `t` value (elapsed seconds) for animated layers.

export type BgDrawer = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
) => void;

function clear(ctx: CanvasRenderingContext2D, w: number, h: number, fill: string | CanvasGradient): void {
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
}

const day: BgDrawer = (ctx, w, h, t) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#7fcaff'); sky.addColorStop(0.7, '#cfe9ff'); sky.addColorStop(1, '#f9efb6');
  clear(ctx, w, h, sky);
  // sun
  ctx.fillStyle = 'rgba(255, 234, 130, 0.9)';
  ctx.beginPath(); ctx.arc(w - 60, 80, 36, 0, Math.PI * 2); ctx.fill();
  // clouds (parallax)
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const offset = (t * 12) % (w + 200);
  for (let i = 0; i < 3; i++) {
    const cx = (i * (w / 2 + 100) - offset + w) % (w + 200) - 100;
    const cy = 100 + i * 60;
    ctx.beginPath();
    ctx.arc(cx,        cy,      20, 0, Math.PI * 2);
    ctx.arc(cx + 20,   cy - 8,  24, 0, Math.PI * 2);
    ctx.arc(cx + 44,   cy,      18, 0, Math.PI * 2);
    ctx.fill();
  }
};

const sunset: BgDrawer = (ctx, w, h) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1c1a3a'); sky.addColorStop(0.4, '#ff6e7f'); sky.addColorStop(0.75, '#ffb37e'); sky.addColorStop(1, '#ffe066');
  clear(ctx, w, h, sky);
  ctx.fillStyle = 'rgba(255, 80, 50, 0.85)';
  ctx.beginPath(); ctx.arc(w / 2, h * 0.7, 80, 0, Math.PI * 2); ctx.fill();
};

const night: BgDrawer = (ctx, w, h, t) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0a0f2c'); sky.addColorStop(1, '#1c1a3a');
  clear(ctx, w, h, sky);
  // stars
  for (let i = 0; i < 70; i++) {
    const sx = (i * 47.31) % w;
    const sy = (i * 31.71) % (h * 0.7);
    const a  = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i));
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }
  // moon
  ctx.fillStyle = '#fff8e7';
  ctx.beginPath(); ctx.arc(w - 70, 90, 30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0a0f2c';
  ctx.beginPath(); ctx.arc(w - 86, 82, 28, 0, Math.PI * 2); ctx.fill();
};

const space: BgDrawer = (ctx, w, h, t) => {
  clear(ctx, w, h, '#02010a');
  // stars warp-drive style
  for (let i = 0; i < 90; i++) {
    const sx = ((i * 53.7 + t * (40 + (i % 5) * 30)) % (w + 60)) - 30;
    const sy = ((i * 91.2) % h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx, sy, 2, 2);
  }
  // distant nebula
  const neb = ctx.createRadialGradient(w * 0.7, h * 0.3, 10, w * 0.7, h * 0.3, 200);
  neb.addColorStop(0, 'rgba(155, 80, 255, 0.4)');
  neb.addColorStop(1, 'rgba(155, 80, 255, 0)');
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, w, h);
};

const underwater: BgDrawer = (ctx, w, h, t) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0a4a7a'); sky.addColorStop(1, '#021a3a');
  clear(ctx, w, h, sky);
  // light rays
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#a3e1ff';
  for (let i = 0; i < 5; i++) {
    const cx = (i * (w / 4) + (t * 20) % w);
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx + 80, h); ctx.lineTo(cx + 100, h); ctx.lineTo(cx + 20, 0);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // bubbles
  for (let i = 0; i < 14; i++) {
    const bx = ((i * 53.1) % w);
    const by = h - ((t * (20 + i * 4) + i * 70) % (h + 60));
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(bx, by, 2 + (i % 3), 0, Math.PI * 2); ctx.fill();
  }
};

const vaporwave: BgDrawer = (ctx, w, h, t) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2a0a5e'); sky.addColorStop(0.5, '#ff5d9e'); sky.addColorStop(1, '#ffd166');
  clear(ctx, w, h, sky);
  // sun
  const sg = ctx.createLinearGradient(0, h * 0.4, 0, h * 0.7);
  sg.addColorStop(0, '#ffd166'); sg.addColorStop(1, '#ff5d9e');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(w / 2, h * 0.6, 70, 0, Math.PI * 2); ctx.fill();
  // sun stripes
  ctx.fillStyle = 'rgba(42, 10, 94, 0.7)';
  for (let i = 1; i <= 5; i++) {
    ctx.fillRect(w / 2 - 80, h * 0.55 + i * 10, 160, 4);
  }
  // grid
  ctx.strokeStyle = 'rgba(40,255,210,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const y = h * 0.7 + (i * i * 3);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  const offset = (t * 40) % 40;
  for (let i = -2; i < 20; i++) {
    const x = (i * (w / 12)) - offset;
    ctx.beginPath(); ctx.moveTo(x + w / 2, h * 0.7); ctx.lineTo(x * 2, h); ctx.stroke();
  }
};

const matrix: BgDrawer = (ctx, w, h, t) => {
  clear(ctx, w, h, '#000');
  ctx.font = '14px monospace';
  for (let col = 0; col < w / 14; col++) {
    const trail = Math.floor((t * (8 + (col % 4) * 4) + col * 30) % (h / 14 + 10));
    for (let row = 0; row < trail; row++) {
      const alpha = 0.05 + (row / trail) * 0.5;
      ctx.fillStyle = `rgba(0, 255, 90, ${alpha.toFixed(2)})`;
      const ch = String.fromCharCode(33 + ((col * 7 + row * 11) % 90));
      ctx.fillText(ch, col * 14, row * 14);
    }
  }
};

export const BG_DRAWERS: Record<string, BgDrawer> = {
  day,
  sunset,
  night,
  space,
  underwater,
  vaporwave,
  matrix,
};

export function getBackgroundDrawer(id: string): BgDrawer {
  return BG_DRAWERS[id] ?? day;
}
