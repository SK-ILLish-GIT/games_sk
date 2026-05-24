import React, { useEffect, useMemo, useRef, useState } from 'react';

import type {
  FlappyCosmetics,
  FlappyConfig,
  FlappyCosmeticOption,
  FlappyUnlockRule,
} from '../../types';

type Category = 'skin' | 'pipe' | 'background' | 'trail' | 'audio';

interface CustomizationPanelProps {
  config:    FlappyConfig;
  selected:  FlappyCosmetics;
  unlocks:   {
    skin:       string[];
    pipe:       string[];
    background: string[];
    trail:      string[];
    audio:      string[];
  };
  bestScore: number;
  onChange:  (next: FlappyCosmetics) => void;
}

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'skin',       label: 'Skin'  },
  { id: 'pipe',       label: 'Pipes' },
  { id: 'background', label: 'Bg'    },
  { id: 'trail',      label: 'Trail' },
  { id: 'audio',      label: 'Audio' },
];

function optionsFor(config: FlappyConfig, cat: Category): readonly FlappyCosmeticOption[] {
  switch (cat) {
    case 'skin':       return config.cosmetics.skins;
    case 'pipe':       return config.cosmetics.pipes;
    case 'background': return config.cosmetics.backgrounds;
    case 'trail':      return config.cosmetics.trails;
    case 'audio':      return config.cosmetics.audio;
  }
}

function unlockRuleFor(rules: FlappyUnlockRule[], cat: Category, id: string): FlappyUnlockRule | undefined {
  return rules.find(r => r.category === cat && r.cosmetic === id);
}

export default function CustomizationPanel({ config, selected, unlocks, bestScore, onChange }: CustomizationPanelProps) {
  const [openCat, setOpenCat] = useState<Category | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape so popovers don't get stuck open.
  useEffect(() => {
    if (!openCat) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenCat(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenCat(null); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [openCat]);

  const lookupByCat = useMemo(() => {
    const build = (items: readonly FlappyCosmeticOption[]): Map<string, FlappyCosmeticOption> =>
      new Map(items.map(i => [i.id, i]));
    return {
      skin:       build(config.cosmetics.skins),
      pipe:       build(config.cosmetics.pipes),
      background: build(config.cosmetics.backgrounds),
      trail:      build(config.cosmetics.trails),
      audio:      build(config.cosmetics.audio),
    } satisfies Record<Category, Map<string, FlappyCosmeticOption>>;
  }, [config]);

  const apply = (cat: Category, id: string) => {
    if (!unlocks[cat].includes(id)) return;
    onChange({ ...selected, [cat]: id });
    setOpenCat(null);
  };

  return (
    <div
      ref={rootRef}
      className="card"
      style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', position: 'relative', zIndex: 40 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 style={{ margin: 0 }}>🎨 Customize</h3>
        <span style={{ fontSize: '0.72rem', color: 'var(--c-text-muted)' }}>
          Best: <strong style={{ color: 'var(--c-text)' }}>{bestScore}</strong>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '0.4rem' }}>
        {CATEGORIES.map(cat => {
          const currentId = selected[cat.id];
          const currentOpt = lookupByCat[cat.id].get(currentId);
          const isOpen = openCat === cat.id;
          return (
            <div key={cat.id} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setOpenCat(o => (o === cat.id ? null : cat.id))}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                style={{
                  width:         '100%',
                  background:    isOpen ? 'var(--c-accent-glow)' : 'var(--c-surface2)',
                  border:        isOpen ? '1px solid var(--c-accent)' : '1px solid var(--c-border)',
                  borderRadius:  'var(--radius-sm)',
                  padding:       '0.45rem 0.5rem',
                  color:         'var(--c-text)',
                  cursor:        'pointer',
                  display:       'flex',
                  flexDirection: 'column',
                  alignItems:    'center',
                  gap:           '0.1rem',
                  fontFamily:    'var(--font)',
                  fontSize:      '0.7rem',
                  minHeight:     58,
                }}
                title={currentOpt?.label}
              >
                <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{currentOpt?.emoji ?? '·'}</span>
                <span style={{ color: 'var(--c-text-muted)' }}>{cat.label}</span>
              </button>

              {isOpen && (
                <CategoryPopover
                  options={optionsFor(config, cat.id)}
                  unlockedIds={unlocks[cat.id]}
                  currentId={currentId}
                  rules={config.unlockRules}
                  category={cat.id}
                  onPick={(id) => apply(cat.id, id)}
                />
              )}
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', margin: 0 }}>
        Tap a category to swap. Locked items show their unlock score.
      </p>
    </div>
  );
}

interface CategoryPopoverProps {
  options:     readonly FlappyCosmeticOption[];
  unlockedIds: string[];
  currentId:   string;
  rules:       FlappyUnlockRule[];
  category:    Category;
  onPick:      (id: string) => void;
}

function CategoryPopover({ options, unlockedIds, currentId, rules, category, onPick }: CategoryPopoverProps) {
  const unlockedSet = new Set(unlockedIds);
  return (
    <div
      role="listbox"
      style={{
        position:     'absolute',
        top:          'calc(100% + 4px)',
        left:         0,
        zIndex:       60,
        width:        'max(220px, 100%)',
        background:   'var(--c-surface)',
        border:       '1px solid var(--c-border)',
        borderRadius: 'var(--radius-sm)',
        boxShadow:    'var(--shadow-card)',
        padding:      '0.4rem',
        maxHeight:    280,
        overflowY:    'auto',
        display:      'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
        gap:          '0.35rem',
      }}
    >
      {options.map(opt => {
        const unlocked = unlockedSet.has(opt.id);
        const isCurrent = currentId === opt.id;
        const rule = unlockRuleFor(rules, category, opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onPick(opt.id)}
            disabled={!unlocked}
            title={!unlocked && rule ? `Unlock at score ${rule.minScore}` : opt.label}
            style={{
              background:    isCurrent ? 'var(--c-accent-glow)' : 'var(--c-surface2)',
              border:        isCurrent ? '1px solid var(--c-accent)' : '1px solid var(--c-border)',
              borderRadius:  'calc(var(--radius-sm) - 2px)',
              padding:       '0.45rem 0.3rem',
              color:         unlocked ? 'var(--c-text)' : 'var(--c-text-muted)',
              cursor:        unlocked ? 'pointer' : 'not-allowed',
              opacity:       unlocked ? 1 : 0.55,
              display:       'flex',
              flexDirection: 'column',
              alignItems:    'center',
              gap:           '0.15rem',
              fontSize:      '0.7rem',
              fontFamily:    'var(--font)',
              minHeight:     62,
            }}
          >
            <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>{opt.emoji}</span>
            <span style={{ fontWeight: isCurrent ? 600 : 500, textAlign: 'center', lineHeight: 1.1 }}>{opt.label}</span>
            {!unlocked && rule && (
              <span style={{ fontSize: '0.6rem', color: 'var(--c-text-muted)' }}>🔒 {rule.minScore}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
