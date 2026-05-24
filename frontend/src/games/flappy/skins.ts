// Canvas-rendered bird skins. Each skin draws into a 30×30 bounding box
// centred on (x, y). Rotation is applied by the engine.

export type SkinDrawer = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rotation: number,
  flap: number,        // 0..1 wing flap phase
) => void;

function withTransform(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rotation: number,
  draw: () => void,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  draw();
  ctx.restore();
}

function eye(ctx: CanvasRenderingContext2D, cx: number, cy: number, r = 3): void {
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0e0f15';
  ctx.beginPath(); ctx.arc(cx + r * 0.35, cy, r * 0.5, 0, Math.PI * 2); ctx.fill();
}

const classic: SkinDrawer = (ctx, x, y, rot, flap) => withTransform(ctx, x, y, rot, () => {
  // body
  const grad = ctx.createRadialGradient(-2, -2, 2, 0, 0, 16);
  grad.addColorStop(0, '#ffe066');
  grad.addColorStop(1, '#f5a510');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
  // wing
  ctx.fillStyle = '#fff1a8';
  ctx.beginPath();
  ctx.ellipse(-3, 2 + Math.sin(flap * Math.PI * 2) * 3, 7, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // beak
  ctx.fillStyle = '#f76d10';
  ctx.beginPath(); ctx.moveTo(10, -2); ctx.lineTo(18, 0); ctx.lineTo(10, 4); ctx.closePath(); ctx.fill();
  eye(ctx, 5, -4);
});

const phoenix: SkinDrawer = (ctx, x, y, rot, flap) => withTransform(ctx, x, y, rot, () => {
  // body
  const grad = ctx.createRadialGradient(-2, -2, 2, 0, 0, 16);
  grad.addColorStop(0, '#ffd166');
  grad.addColorStop(0.5, '#f76d10');
  grad.addColorStop(1, '#c0392b');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
  // flame crest
  ctx.fillStyle = '#fff1a8';
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(-3, -20); ctx.lineTo(2, -16); ctx.lineTo(0, -22); ctx.lineTo(4, -16); ctx.lineTo(8, -20); ctx.lineTo(6, -12); ctx.closePath(); ctx.fill();
  // wing
  ctx.fillStyle = '#ffe066';
  ctx.beginPath();
  ctx.ellipse(-3, 2 + Math.sin(flap * Math.PI * 2) * 4, 8, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // beak
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.moveTo(10, -2); ctx.lineTo(18, 0); ctx.lineTo(10, 4); ctx.closePath(); ctx.fill();
  eye(ctx, 5, -4);
});

const ninja: SkinDrawer = (ctx, x, y, rot, flap) => withTransform(ctx, x, y, rot, () => {
  // black body
  ctx.fillStyle = '#1a1d28';
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
  // mask
  ctx.fillStyle = '#0e0f15';
  ctx.fillRect(-10, -3, 22, 5);
  // wing
  ctx.fillStyle = '#2c2f3d';
  ctx.beginPath();
  ctx.ellipse(-3, 2 + Math.sin(flap * Math.PI * 2) * 3, 7, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // beak
  ctx.fillStyle = '#444';
  ctx.beginPath(); ctx.moveTo(10, -1); ctx.lineTo(17, 1); ctx.lineTo(10, 3); ctx.closePath(); ctx.fill();
  // glowing red eye
  ctx.fillStyle = '#ef5350';
  ctx.beginPath(); ctx.arc(6, -1, 2.4, 0, Math.PI * 2); ctx.fill();
});

const ufo: SkinDrawer = (ctx, x, y, rot, _flap) => withTransform(ctx, x, y, rot, () => {
  // dome
  const dome = ctx.createLinearGradient(0, -10, 0, 0);
  dome.addColorStop(0, '#a3e1ff'); dome.addColorStop(1, '#5cb6e6');
  ctx.fillStyle = dome;
  ctx.beginPath(); ctx.ellipse(0, -2, 8, 7, 0, Math.PI, 0); ctx.fill();
  // disc
  const disc = ctx.createLinearGradient(0, 0, 0, 8);
  disc.addColorStop(0, '#cfd5e5'); disc.addColorStop(1, '#6b7180');
  ctx.fillStyle = disc;
  ctx.beginPath(); ctx.ellipse(0, 2, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
  // lights
  for (let i = -2; i <= 2; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#ff5a5f' : '#ffe066';
    ctx.beginPath(); ctx.arc(i * 5, 4, 1.4, 0, Math.PI * 2); ctx.fill();
  }
});

const pixel: SkinDrawer = (ctx, x, y, rot, flap) => withTransform(ctx, x, y, rot, () => {
  // 8x8 pixel art bird, each pixel = 3x3
  const p = 3;
  const palette = ['transparent', '#f76d10', '#ffd166', '#0e0f15', '#fff'];
  const sprite = [
    '00022200',
    '02222230',
    '22422220',
    '22444210',
    '22222110',
    '02222200',
    '00111000',
    '00000000',
  ];
  const wingOffset = Math.sin(flap * Math.PI * 2) > 0 ? 0 : 1;
  for (let r = 0; r < sprite.length; r++) {
    for (let c = 0; c < sprite[r].length; c++) {
      const idx = Number(sprite[r][c]);
      if (idx === 0) continue;
      ctx.fillStyle = palette[idx];
      ctx.fillRect((c - 4) * p, (r - 4 + wingOffset) * p, p + 0.5, p + 0.5);
    }
  }
});

const rubberDuck: SkinDrawer = (ctx, x, y, rot, flap) => withTransform(ctx, x, y, rot, () => {
  // body
  ctx.fillStyle = '#ffdf3a';
  ctx.beginPath(); ctx.ellipse(0, 2, 14, 11, 0, 0, Math.PI * 2); ctx.fill();
  // head
  ctx.beginPath(); ctx.arc(6, -6, 8, 0, Math.PI * 2); ctx.fill();
  // wing
  ctx.fillStyle = '#f5b400';
  ctx.beginPath();
  ctx.ellipse(-3, 4 + Math.sin(flap * Math.PI * 2) * 2, 6, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // beak
  ctx.fillStyle = '#f76d10';
  ctx.beginPath(); ctx.ellipse(13, -4, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  eye(ctx, 8, -8, 2);
});

const rocket: SkinDrawer = (ctx, x, y, rot, flap) => withTransform(ctx, x, y, rot, () => {
  // body
  const body = ctx.createLinearGradient(0, -8, 0, 8);
  body.addColorStop(0, '#f3f4f6'); body.addColorStop(1, '#9ca3af');
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(8, -6); ctx.lineTo(16, 0); ctx.lineTo(8, 6); ctx.lineTo(-12, 6); ctx.closePath(); ctx.fill();
  // fin
  ctx.fillStyle = '#ef5350';
  ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(-16, -10); ctx.lineTo(-10, -6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-12, 6); ctx.lineTo(-16, 10); ctx.lineTo(-10, 6); ctx.closePath(); ctx.fill();
  // porthole
  ctx.fillStyle = '#5cb6e6';
  ctx.beginPath(); ctx.arc(2, 0, 3.5, 0, Math.PI * 2); ctx.fill();
  // flame
  const flame = 4 + Math.sin(flap * Math.PI * 4) * 2;
  const fg = ctx.createLinearGradient(-16, 0, -16 - flame * 2, 0);
  fg.addColorStop(0, '#ffd166'); fg.addColorStop(1, '#f76d10');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-12, -4);
  ctx.lineTo(-16 - flame * 2, 0);
  ctx.lineTo(-12, 4);
  ctx.closePath();
  ctx.fill();
});

export const SKIN_DRAWERS: Record<string, SkinDrawer> = {
  classic,
  phoenix,
  ninja,
  ufo,
  pixel,
  'rubber-duck': rubberDuck,
  rocket,
};

export function getSkinDrawer(id: string): SkinDrawer {
  return SKIN_DRAWERS[id] ?? classic;
}
