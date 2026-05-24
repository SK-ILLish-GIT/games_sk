import React, { useEffect, useRef, useState } from 'react';

import { FlappyMode } from '../../enums/game.enum';
import type { FlappyModeDefinition } from '../../types';

interface ModePickerProps {
  modes:    FlappyModeDefinition[];
  selected: FlappyMode;
  bestByMode: Record<string, number>;
  onSelect: (mode: FlappyMode) => void;
}

const EMOJIS: Record<string, string> = {
  [FlappyMode.Endless]:     '♾️',
  [FlappyMode.TimeAttack]:  '⏱️',
  [FlappyMode.GravityFlip]: '🔃',
  [FlappyMode.Reverse]:     '↩️',
  [FlappyMode.Chaos]:       '🌀',
  [FlappyMode.DailySeed]:   '📅',
};

export default function ModePicker({ modes, selected, bestByMode, onSelect }: ModePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape so the popover doesn't get stuck open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = modes.find(m => m.id === selected) ?? modes[0];
  const currentBest = bestByMode[current.id] ?? 0;

  return (
    <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', position: 'relative', zIndex: 50 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 style={{ margin: 0 }}>🎮 Mode</h3>
        <span style={{ fontSize: '0.72rem', color: 'var(--c-text-muted)' }}>
          Best: <strong style={{ color: 'var(--c-text)' }}>{currentBest}</strong>
        </span>
      </div>

      <div ref={rootRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          style={{
            width:         '100%',
            background:    'var(--c-surface2)',
            border:        '1px solid var(--c-border)',
            borderRadius:  'var(--radius-sm)',
            padding:       '0.55rem 0.75rem',
            color:         'var(--c-text)',
            cursor:        'pointer',
            display:       'flex',
            alignItems:    'center',
            gap:           '0.5rem',
            fontFamily:    'var(--font)',
            fontSize:      '0.9rem',
            textAlign:     'left',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>{EMOJIS[current.id] ?? '🎯'}</span>
          <span style={{ fontWeight: 600 }}>{current.label}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', color: 'var(--c-text-muted)' }}>
            <span>×{current.scoreMultiplier}</span>
            <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
          </span>
        </button>

        {open && (
          <div
            role="listbox"
            style={{
              position:     'absolute',
              top:          'calc(100% + 4px)',
              left:         0,
              right:        0,
              zIndex:       30,
              background:   'var(--c-surface)',
              border:       '1px solid var(--c-border)',
              borderRadius: 'var(--radius-sm)',
              boxShadow:    'var(--shadow-card)',
              padding:      '0.35rem',
              maxHeight:    320,
              overflowY:    'auto',
            }}
          >
            {modes.map(m => {
              const active = m.id === selected;
              const best   = bestByMode[m.id] ?? 0;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { onSelect(m.id); setOpen(false); }}
                  style={{
                    width:         '100%',
                    background:    active ? 'var(--c-accent-glow)' : 'transparent',
                    border:        active ? '1px solid var(--c-accent)' : '1px solid transparent',
                    borderRadius:  'calc(var(--radius-sm) - 2px)',
                    padding:       '0.5rem 0.6rem',
                    color:         'var(--c-text)',
                    cursor:        'pointer',
                    textAlign:     'left',
                    display:       'flex',
                    flexDirection: 'column',
                    gap:           '0.15rem',
                    fontFamily:    'var(--font)',
                  }}
                  title={m.description}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ fontSize: '1rem' }}>{EMOJIS[m.id] ?? '🎯'}</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{m.label}</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.6rem', fontSize: '0.7rem', color: 'var(--c-text-muted)' }}>
                      <span>×{m.scoreMultiplier}</span>
                      <span>Best: <strong style={{ color: 'var(--c-text)' }}>{best}</strong></span>
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', lineHeight: 1.3 }}>
                    {m.description}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
