import React from 'react';
import { Link } from 'react-router-dom';

import type { FlappyFinishResponse, FlappyUnlockRule } from '../../types';
import StarBorder from '../ui/StarBorder';

interface GameOverModalProps {
  result:        FlappyFinishResponse | null;
  rejectReason?: string | null;
  rawScore?:     number;
  onPlayAgain:   () => void;
  onChangeMode:  () => void;
  onClose:       () => void;
}

function UnlockToast({ unlock }: { unlock: FlappyUnlockRule }) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          '0.6rem',
      background:   'var(--c-surface2)',
      border:       '1px solid var(--c-accent)',
      borderRadius: 'var(--radius-sm)',
      padding:      '0.5rem 0.75rem',
    }}>
      <span style={{ fontSize: '1.3rem' }}>{unlock.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{unlock.label}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)' }}>Unlocked at score {unlock.minScore}</div>
      </div>
      <span style={{ fontSize: '0.7rem', color: 'var(--c-accent)' }}>NEW</span>
    </div>
  );
}

export default function GameOverModal({
  result,
  rejectReason,
  rawScore,
  onPlayAgain,
  onChangeMode,
  onClose,
}: GameOverModalProps) {
  if (!result && !rejectReason) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        zIndex:         100,
        padding:        '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card"
        style={{
          maxWidth:     440,
          width:        '100%',
          padding:      '1.5rem',
          display:      'flex',
          flexDirection: 'column',
          gap:          '1rem',
        }}
      >
        {result && (
          <>
            {result.newHighScore ? (
              <StarBorder color="var(--c-accent2)" speed="3s" style={{ width: '100%' }}>
                <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--c-surface)', borderRadius: 'calc(var(--radius-sm) - 1px)' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>🏆 New personal best!</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>You beat your previous record in this mode.</div>
                </div>
              </StarBorder>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--c-surface2)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>💥 Run over</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>Nice flying.</div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <Stat label="Score"    value={result.score} />
              <Stat label="Pipes"    value={result.rawScore} />
              <Stat label="Flaps"    value={result.jumps} />
            </div>

            {result.unlocks.length > 0 && (
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  🎁 You unlocked {result.unlocks.length} cosmetic{result.unlocks.length === 1 ? '' : 's'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {result.unlocks.map(u => <UnlockToast key={`${u.category}-${u.cosmetic}`} unlock={u} />)}
                </div>
              </div>
            )}
          </>
        )}

        {!result && rejectReason && (
          <div className="alert alert-error" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Run rejected</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>Server validation: <code>{rejectReason}</code></div>
            {typeof rawScore === 'number' && (
              <div style={{ fontSize: '0.8rem', color: 'var(--c-text-muted)', marginTop: '0.4rem' }}>
                Your raw score was {rawScore}. The score wasn’t submitted to the leaderboard.
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginTop: '0.25rem' }}>
          <button className="btn btn-primary" onClick={onPlayAgain} style={{ minWidth: 130 }}>🔄 Play again</button>
          <button className="btn btn-secondary" onClick={onChangeMode}>Change mode</button>
          <Link to="/leaderboard">
            <button className="btn btn-secondary">🏆 Leaderboard</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      background:   'var(--c-surface2)',
      borderRadius: 'var(--radius-sm)',
      padding:      '0.6rem',
      textAlign:    'center',
    }}>
      <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}
