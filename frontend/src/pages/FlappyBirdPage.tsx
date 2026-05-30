import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { flappyAPI, getApiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FlappyMode } from '../enums/game.enum';
import type {
  FlappyConfig,
  FlappyCosmetics,
  FlappyFinishResponse,
  FlappyStartResponse,
} from '../types';

import BlurText from '../components/ui/BlurText';
import Loader from '../components/ui/Loader';

import CustomizationPanel from '../components/flappy/CustomizationPanel';
import ModePicker from '../components/flappy/ModePicker';
import GameOverModal from '../components/flappy/GameOverModal';

import {
  BIRD_X,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GROUND_HEIGHT,
  PIPE_WIDTH,
  createState,
  flap,
  tick,
  timeAttackOver,
  type GameState,
} from '../games/flappy/engine';
import { getBackgroundDrawer } from '../games/flappy/backgrounds';
import { drawPipe, getPipeTheme } from '../games/flappy/pipeThemes';
import { getSkinDrawer } from '../games/flappy/skins';
import { getTrail } from '../games/flappy/trails';
import { playAudio, unlockAudio } from '../games/flappy/audio';

const STORAGE_KEYS = {
  cosmetics: 'flappy:cosmetics',
  unlocks:   'flappy:unlocks',
  bestByMode: 'flappy:bestByMode',
};

type PerCatUnlocks = {
  skin:       string[];
  pipe:       string[];
  background: string[];
  trail:      string[];
  audio:      string[];
};

const FIXED_DT = 1 / 60;
const MAX_DT   = 0.1;

function defaultUnlocks(config: FlappyConfig): PerCatUnlocks {
  // Anything in the catalogue that has no unlock rule is unlocked by default.
  const ruleSet = new Set(config.unlockRules.map(r => `${r.category}:${r.cosmetic}`));
  const filter = (cat: keyof PerCatUnlocks, items: readonly { id: string }[]) =>
    items.map(i => i.id).filter(id => !ruleSet.has(`${cat}:${id}`));
  return {
    skin:       filter('skin',       config.cosmetics.skins),
    pipe:       filter('pipe',       config.cosmetics.pipes),
    background: filter('background', config.cosmetics.backgrounds),
    trail:      filter('trail',      config.cosmetics.trails),
    audio:      filter('audio',      config.cosmetics.audio),
  };
}

function mergeUnlocks(base: PerCatUnlocks, override: Partial<PerCatUnlocks>): PerCatUnlocks {
  return {
    skin:       Array.from(new Set([...base.skin,       ...(override.skin       ?? [])])),
    pipe:       Array.from(new Set([...base.pipe,       ...(override.pipe       ?? [])])),
    background: Array.from(new Set([...base.background, ...(override.background ?? [])])),
    trail:      Array.from(new Set([...base.trail,      ...(override.trail      ?? [])])),
    audio:      Array.from(new Set([...base.audio,      ...(override.audio      ?? [])])),
  };
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

export default function FlappyBirdPage() {
  const { user } = useAuth();

  const [config, setConfig]                 = useState<FlappyConfig | null>(null);
  const [selectedMode, setSelectedMode]     = useState<FlappyMode>(FlappyMode.Endless);
  const [cosmetics, setCosmetics]           = useState<FlappyCosmetics | null>(null);
  const [unlocks, setUnlocks]               = useState<PerCatUnlocks | null>(null);
  const [bestByMode, setBestByMode]         = useState<Record<string, number>>({});
  const [phase, setPhase]                   = useState<'idle' | 'loading' | 'playing' | 'finished'>('idle');
  const [error, setError]                   = useState('');
  const [activeRun, setActiveRun]           = useState<FlappyStartResponse | null>(null);
  const [result, setResult]                 = useState<FlappyFinishResponse | null>(null);
  const [rejectReason, setRejectReason]     = useState<string | null>(null);
  const [rawRejectScore, setRawRejectScore] = useState<number | undefined>(undefined);
  const [hudScore, setHudScore]             = useState(0);
  const [hudTime, setHudTime]               = useState(0);

  const canvasRef       = useRef<HTMLCanvasElement | null>(null);
  const gameStateRef    = useRef<GameState | null>(null);
  const rafIdRef        = useRef<number | null>(null);
  const lastFrameRef    = useRef<number>(0);
  const accumulatorRef  = useRef<number>(0);
  const finishedRef     = useRef<boolean>(false);

  // ── Load config + profile on mount ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    flappyAPI.config()
      .then(r => {
        if (cancelled) return;
        const cfg = r.data.data;
        setConfig(cfg);
        // Pull saved cosmetics from API (signed-in) or localStorage (guest)
        if (user) {
          flappyAPI.myProfile()
            .then(p => {
              if (cancelled) return;
              const profile = p.data.data;
              const base = defaultUnlocks(cfg);
              setUnlocks(mergeUnlocks(base, {
                skin:       profile.unlockedSkins,
                pipe:       profile.unlockedPipes,
                background: profile.unlockedBackgrounds,
                trail:      profile.unlockedTrails,
                audio:      profile.unlockedAudio,
              }));
              setCosmetics(profile.selected ?? cfg.defaultLoadout);
              setBestByMode(profile.highScores ?? {});
            })
            .catch(() => {
              // Fallback: treat as guest if profile call fails
              setUnlocks(defaultUnlocks(cfg));
              setCosmetics(readJson<FlappyCosmetics>(STORAGE_KEYS.cosmetics) ?? cfg.defaultLoadout);
              setBestByMode(readJson<Record<string, number>>(STORAGE_KEYS.bestByMode) ?? {});
            });
        } else {
          const guestUnlocks = readJson<Partial<PerCatUnlocks>>(STORAGE_KEYS.unlocks) ?? {};
          setUnlocks(mergeUnlocks(defaultUnlocks(cfg), guestUnlocks));
          setCosmetics(readJson<FlappyCosmetics>(STORAGE_KEYS.cosmetics) ?? cfg.defaultLoadout);
          setBestByMode(readJson<Record<string, number>>(STORAGE_KEYS.bestByMode) ?? {});
        }
      })
      .catch((err: unknown) => setError(getApiErrorMessage(err, 'Failed to load game config')));
    return () => { cancelled = true; };
  }, [user]);

  // ── Persist cosmetics changes ─────────────────────────────────────
  // Server-side for signed-in users; localStorage for guests.
  const handleCosmeticsChange = useCallback((next: FlappyCosmetics) => {
    setCosmetics(next);
    writeJson(STORAGE_KEYS.cosmetics, next);
    if (user) {
      void flappyAPI.saveLoadout(next).catch(() => { /* best-effort */ });
    }
  }, [user]);

  // ── Render frame ──────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const state  = gameStateRef.current;
    if (!canvas || !state || !cosmetics) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bg   = getBackgroundDrawer(cosmetics.background);
    const pipe = getPipeTheme(cosmetics.pipe);
    const skin = getSkinDrawer(cosmetics.skin);
    const trail = getTrail(cosmetics.trail);

    // Layers
    bg(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, state.elapsed);

    for (const p of state.pipes) {
      const topH    = p.gapY - p.gap / 2;
      const bottomY = p.gapY + p.gap / 2;
      const bottomH = CANVAS_HEIGHT - GROUND_HEIGHT - bottomY;
      drawPipe(ctx, pipe, p.x, 0,       PIPE_WIDTH, topH,    true);
      drawPipe(ctx, pipe, p.x, bottomY, PIPE_WIDTH, bottomH, false);
    }

    // Ground
    const groundY = CANVAS_HEIGHT - GROUND_HEIGHT;
    const gradient = ctx.createLinearGradient(0, groundY, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#a36e2a'); gradient.addColorStop(1, '#5a3e16');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, groundY, CANVAS_WIDTH, GROUND_HEIGHT);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < CANVAS_WIDTH / 24; i++) {
      ctx.fillRect(((i * 24) - (state.distance % 24)), groundY + 6, 12, 4);
    }

    // Particles (under bird)
    for (const p of state.particles) trail.draw(ctx, p);

    // Bird
    skin(ctx, BIRD_X, state.bird.y, state.bird.rotation, state.bird.flap);

    // HUD overlay
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, 36);
    ctx.fillStyle = '#fff';
    ctx.font = '600 18px Outfit, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Score: ${state.score}`, 12, 18);
    if (state.mode === FlappyMode.TimeAttack && activeRun?.durationCapSec) {
      const left = Math.max(0, activeRun.durationCapSec - state.elapsed);
      ctx.textAlign = 'right';
      ctx.fillText(`⏱️ ${left.toFixed(1)}s`, CANVAS_WIDTH - 12, 18);
      ctx.textAlign = 'left';
    } else {
      ctx.textAlign = 'right';
      ctx.fillText(`Mode: ${state.mode}`, CANVAS_WIDTH - 12, 18);
      ctx.textAlign = 'left';
    }

    // Pre-start prompt
    if (state.status === 'ready') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#fff';
      ctx.font = '700 26px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Tap / Space to flap', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
      ctx.font = '400 15px Outfit, system-ui, sans-serif';
      ctx.fillText(`${state.mode} mode`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 18);
      ctx.textAlign = 'left';
    }
  }, [cosmetics, activeRun]);

  // ── Finish run (POST /finish) ─────────────────────────────────────
  const finishRun = useCallback(async (state: GameState) => {
    if (!activeRun || finishedRef.current) return;
    finishedRef.current = true;

    const audioId = cosmetics?.audio ?? 'chiptune';
    playAudio(audioId, 'death');

    try {
      const r = await flappyAPI.finish(activeRun.gameId, {
        score:      state.score,
        distance:   Math.round(state.distance),
        jumps:      state.jumps,
        durationMs: Math.round(state.elapsed * 1000),
        signature:  activeRun.signature,
      });
      const data = r.data.data;
      setResult(data);
      setRejectReason(null);

      // Update local best
      setBestByMode(prev => {
        const next = { ...prev };
        if ((next[data.mode] ?? 0) < data.score) next[data.mode] = data.score;
        writeJson(STORAGE_KEYS.bestByMode, next);
        return next;
      });

      // Apply unlocks for guests (signed-in users get them server-side)
      if (!user && data.unlocks.length > 0) {
        setUnlocks(prev => {
          if (!prev) return prev;
          const next: PerCatUnlocks = {
            skin:       [...prev.skin],
            pipe:       [...prev.pipe],
            background: [...prev.background],
            trail:      [...prev.trail],
            audio:      [...prev.audio],
          };
          for (const u of data.unlocks) {
            const bucket = next[u.category as keyof PerCatUnlocks];
            if (!bucket.includes(u.cosmetic)) bucket.push(u.cosmetic);
          }
          writeJson(STORAGE_KEYS.unlocks, next);
          return next;
        });
      }
    } catch (err: unknown) {
      // Server rejected the run (e.g. score_rate_exceeded).
      const message = getApiErrorMessage(err, 'Run rejected by server');
      const reason  = message.replace(/^Run rejected:\s*/, '');
      setRejectReason(reason);
      setResult(null);
      setRawRejectScore(state.score);
    }

    setPhase('finished');
  }, [activeRun, cosmetics, user]);

  // ── rAF loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing' || !activeRun) return;

    const loop = (now: number) => {
      const state = gameStateRef.current;
      if (!state) return;
      const last  = lastFrameRef.current;
      lastFrameRef.current = now;
      let dt = Math.min(MAX_DT, (now - last) / 1000);
      if (!isFinite(dt) || dt < 0) dt = 0;

      accumulatorRef.current += dt;
      let prevScore = state.score;
      while (accumulatorRef.current >= FIXED_DT) {
        tick(state, FIXED_DT);
        accumulatorRef.current -= FIXED_DT;
        timeAttackOver(state, activeRun.durationCapSec ?? null);
        if (state.score > prevScore) {
          playAudio(cosmetics?.audio ?? 'chiptune', 'score');
          prevScore = state.score;
        }
        if (state.status === 'over') break;
      }

      draw();
      setHudScore(state.score);
      setHudTime(state.elapsed);

      if (state.status === 'over') {
        rafIdRef.current = null;
        void finishRun(state);
        return;
      }
      rafIdRef.current = requestAnimationFrame(loop);
    };

    lastFrameRef.current   = performance.now();
    accumulatorRef.current = 0;
    rafIdRef.current       = requestAnimationFrame(loop);

    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    };
  }, [phase, activeRun, cosmetics, draw, finishRun]);

  // ── Idle/preview render so the canvas isn't blank when not playing ─
  useEffect(() => {
    if (phase === 'playing' || !cosmetics) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const bg = getBackgroundDrawer(cosmetics.background);
    bg(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, performance.now() / 1000);
    // ground
    ctx.fillStyle = '#5a3e16';
    ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);
    // preview bird
    const skin = getSkinDrawer(cosmetics.skin);
    skin(ctx, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0, (performance.now() / 200) % 1);
    // copy
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, CANVAS_HEIGHT / 2 + 40, CANVAS_WIDTH, 70);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '700 24px Outfit, system-ui, sans-serif';
    ctx.fillText('Press Start to fly', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 72);
    ctx.font = '400 14px Outfit, system-ui, sans-serif';
    ctx.fillText(`Mode: ${selectedMode}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 96);
    ctx.textAlign = 'left';
  }, [phase, cosmetics, selectedMode]);

  // ── Input handlers ────────────────────────────────────────────────
  const doFlap = useCallback(() => {
    const state = gameStateRef.current;
    if (!state || phase !== 'playing') return;
    void unlockAudio();
    const result = flap(state);
    if (result.jumped) playAudio(cosmetics?.audio ?? 'chiptune', 'flap');
  }, [phase, cosmetics]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        doFlap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doFlap]);

  // ── Start / restart ───────────────────────────────────────────────
  const startGame = useCallback(async () => {
    if (!cosmetics) return;
    setError('');
    setResult(null);
    setRejectReason(null);
    setRawRejectScore(undefined);
    setPhase('loading');
    try {
      const r = await flappyAPI.create(selectedMode, cosmetics);
      const data = r.data.data;
      setActiveRun(data);
      gameStateRef.current = createState({
        physics: data.physics,
        mode:    data.mode,
        seed:    data.seed,
        trailId: cosmetics.trail,
      });
      finishedRef.current = false;
      setHudScore(0);
      setHudTime(0);
      setPhase('playing');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to start game'));
      setPhase('idle');
    }
  }, [cosmetics, selectedMode]);

  const closeModalAndReset = useCallback(() => {
    setResult(null);
    setRejectReason(null);
    setActiveRun(null);
    gameStateRef.current = null;
    setPhase('idle');
  }, []);

  const bestForCurrentMode = useMemo(
    () => bestByMode[selectedMode] ?? 0,
    [bestByMode, selectedMode],
  );

  // ── Loading / error states ────────────────────────────────────────
  if (!config || !cosmetics || !unlocks) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 1100, padding: '3rem 1.5rem' }}>
          {error
            ? <div className="alert alert-error">{error}</div>
            : <div className="flex-center" style={{ minHeight: 240, flexDirection: 'column', gap: '1rem' }}>
                <Loader size="md" />
                <p>Loading game…</p>
              </div>
          }
        </div>
      </div>
    );
  }

  const cosmeticUnlocksByCat = unlocks; // alias for prop name

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 1200 }}>
        <div className="page-header" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 className="page-title">
            <BlurText text="🐤 Flappy Bird" delay={50} />
          </h1>
          <p>Funky modes, particle trails, daily seed, server-validated scores.</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="flappy-layout" style={{
          display:             'grid',
          gridTemplateColumns: 'minmax(260px, 300px) 1fr',
          gap:                 '1.25rem',
          alignItems:          'start',
        }}>
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 640 }}>
            <ModePicker
              modes={config.modes}
              selected={selectedMode}
              bestByMode={bestByMode}
              onSelect={setSelectedMode}
            />
            <CustomizationPanel
              config={config}
              selected={cosmetics}
              unlocks={cosmeticUnlocksByCat}
              bestScore={bestForCurrentMode}
              onChange={handleCosmeticsChange}
            />
            {!user && (
              <div className="card" style={{ padding: '0.85rem', fontSize: '0.78rem', color: 'var(--c-text-muted)' }}>
                Playing as guest — sign in to save unlocks and submit scores to the global leaderboard.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>
              {phase !== 'playing' && (
                <button
                  id="flappy-start"
                  className="btn btn-primary"
                  onClick={startGame}
                  disabled={phase === 'loading'}
                  style={{ width: '100%' }}
                >
                  {phase === 'loading'
                    ? <Loader size="sm" color="#fff" />
                    : bestForCurrentMode > 0 ? '🔄 New Game' : '▶ Start Game'}
                </button>
              )}
              <Link to="/leaderboard">
                <button className="btn btn-secondary" style={{ width: '100%' }}>🏆 Leaderboard</button>
              </Link>
            </div>
          </aside>

          <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div
              onPointerDown={doFlap}
              style={{
                position:     'relative',
                borderRadius: 'var(--radius-md)',
                overflow:     'hidden',
                border:       '1px solid var(--c-border)',
                boxShadow:    'var(--shadow-card)',
                width:        '100%',
                maxWidth:     820,
                aspectRatio:  `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
                cursor:       phase === 'playing' ? 'crosshair' : 'pointer',
                touchAction:  'manipulation',
                userSelect:   'none',
              }}
            >
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
              {phase === 'playing' && (
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--c-text-muted)' }}>
                  <span>Score: <strong style={{ color: 'var(--c-text)' }}>{hudScore}</strong></span>
                  <span>·</span>
                  <span>Time: <strong style={{ color: 'var(--c-text)' }}>{hudTime.toFixed(1)}s</strong></span>
                  <span>·</span>
                  <span>Tap/Space to flap</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <GameOverModal
        result={result}
        rejectReason={rejectReason}
        rawScore={rawRejectScore}
        onPlayAgain={() => { closeModalAndReset(); void startGame(); }}
        onChangeMode={closeModalAndReset}
        onClose={closeModalAndReset}
      />

      <style>{`
        @media (max-width: 900px) {
          .flappy-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
