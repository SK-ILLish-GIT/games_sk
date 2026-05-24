// Audio packs synthesized with WebAudio. No external assets — keeps the
// frontend bundle small and avoids licensing concerns.

export type AudioEvent = 'flap' | 'score' | 'death';

interface AudioPack {
  id:   string;
  flap: (ctx: AudioContext, master: GainNode) => void;
  score:(ctx: AudioContext, master: GainNode) => void;
  death:(ctx: AudioContext, master: GainNode) => void;
}

function blip(
  ctx: AudioContext,
  master: GainNode,
  freq: number,
  duration: number,
  type: OscillatorType = 'square',
  glide?: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (glide !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, glide), ctx.currentTime + duration);
  }
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain).connect(master);
  osc.start();
  osc.stop(ctx.currentTime + duration + 0.02);
}

const chiptune: AudioPack = {
  id: 'chiptune',
  flap:  (c, m) => blip(c, m, 660, 0.08, 'square', 880),
  score: (c, m) => { blip(c, m, 880, 0.06, 'square'); setTimeout(() => blip(c, m, 1320, 0.08, 'square'), 60); },
  death: (c, m) => { blip(c, m, 440, 0.15, 'sawtooth', 110); },
};

const lofi: AudioPack = {
  id: 'lofi',
  flap:  (c, m) => blip(c, m, 320, 0.12, 'sine', 220),
  score: (c, m) => blip(c, m, 520, 0.18, 'triangle', 660),
  death: (c, m) => blip(c, m, 220, 0.4, 'sine', 80),
};

const synthwave: AudioPack = {
  id: 'synthwave',
  flap:  (c, m) => { blip(c, m, 740, 0.1, 'sawtooth', 600); },
  score: (c, m) => { blip(c, m, 660, 0.08, 'sawtooth'); setTimeout(() => blip(c, m, 990, 0.12, 'sawtooth'), 70); },
  death: (c, m) => { blip(c, m, 330, 0.3, 'sawtooth', 60); setTimeout(() => blip(c, m, 220, 0.3, 'sawtooth', 50), 80); },
};

const mute: AudioPack = {
  id: 'mute',
  flap:  () => {},
  score: () => {},
  death: () => {},
};

const PACKS: Record<string, AudioPack> = { chiptune, lofi, synthwave, mute };

let audioCtx: AudioContext | null = null;
let master: GainNode | null = null;

function ensureContext(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    master   = audioCtx.createGain();
    master.gain.value = 0.5;
    master.connect(audioCtx.destination);
  }
  return { ctx: audioCtx, master: master! };
}

// Browsers require a user gesture before audio starts; call this from the
// first `pointerdown` / `keydown` so subsequent SFX work without warnings.
export async function unlockAudio(): Promise<void> {
  const a = ensureContext();
  if (!a) return;
  if (a.ctx.state === 'suspended') {
    try { await a.ctx.resume(); } catch { /* ignore */ }
  }
}

export function playAudio(packId: string, event: AudioEvent): void {
  const a = ensureContext();
  if (!a) return;
  const pack = PACKS[packId] ?? chiptune;
  if (pack.id === 'mute') return;
  try {
    pack[event](a.ctx, a.master);
  } catch {
    // Audio is best-effort — never throw out of an SFX call.
  }
}

export function setAudioVolume(v: number): void {
  const a = ensureContext();
  if (!a || !a.master) return;
  a.master.gain.value = Math.max(0, Math.min(1, v));
}
