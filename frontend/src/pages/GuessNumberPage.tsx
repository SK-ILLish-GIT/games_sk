import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { guessAPI, getApiErrorMessage } from '../api/client';
import { GuessStatus, Hint } from '../enums/game.enum';
import type { GuessNumberGame } from '../types';
import BlurText from '../components/ui/BlurText';
import SpotlightCard from '../components/ui/SpotlightCard';
import StarBorder from '../components/ui/StarBorder';
import Loader from '../components/ui/Loader';

type GameState = GuessNumberGame;

export default function GuessNumberPage() {
  const [game, setGame] = useState<GameState | null>(null);
  const [guessInput, setGuessInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const startGame = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await guessAPI.create();
      setGame(r.data.data);
      setGuessInput('');
    } catch {
      setError('Failed to start game. Is the service running?');
    } finally {
      setLoading(false);
    }
  };

  const submitGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!game || !guessInput) return;
    const num = parseInt(guessInput, 10);
    if (isNaN(num) || num < 1 || num > 100) { setError('Enter a number between 1 and 100'); return; }
    setSubmitting(true);
    setError('');
    try {
      const r = await guessAPI.guess(game.gameId, num);
      setGame(r.data.data as GameState);
      setGuessInput('');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Guess failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const hintLabel = (hint: Hint): string => {
    if (hint === Hint.TooLow)  return '⬆️ Too low';
    if (hint === Hint.TooHigh) return '⬇️ Too high';
    return '✅ Correct!';
  };

  const maxAttempts  = game?.maxAttempts ?? 7;
  const attemptsUsed = game?.attempts ?? 0;
  const attemptsLeft = Math.max(0, maxAttempts - attemptsUsed);
  const meterWidth   = `${Math.min(100, (attemptsUsed / maxAttempts) * 100)}%`;
  const isActive     = game?.status === GuessStatus.Active;
  const score        = game ? Math.max(10, 100 - (game.attempts - 1) * 15) : 0;

  const renderStatus = () => {
    if (!game) {
      return (
        <>
          <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
            Status
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600 }}>Press Start Game to begin</div>
          <p style={{ fontSize: '0.78rem', color: 'var(--c-text-muted)', marginTop: '0.35rem' }}>
            A secret number between 1 and 100. You have 7 attempts.
          </p>
        </>
      );
    }
    if (game.status === GuessStatus.Won) {
      return (
        <StarBorder color="var(--c-green)" speed="3s" style={{ width: '100%' }}>
          <div style={{ padding: '0.85rem 1rem', background: 'var(--c-surface)', borderRadius: 'calc(var(--radius-sm) - 1px)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Solved
            </div>
            <div style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>
              🎉 Got it in {game.attempts} attempt{game.attempts !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
              Score: <span style={{ color: 'var(--c-green)' }}>{score}</span>
            </div>
          </div>
        </StarBorder>
      );
    }
    if (game.status === GuessStatus.Lost) {
      return (
        <div className="alert alert-error" style={{ textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
            Out of attempts
          </div>
          <div style={{ fontSize: '0.95rem' }}>😔 Better luck next round.</div>
        </div>
      );
    }
    return (
      <>
        <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
          Attempts
        </div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1 }}>
          {attemptsLeft}<span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--c-text-muted)' }}> / {maxAttempts} left</span>
        </div>
      </>
    );
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 1200 }}>
        <div className="page-header" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 className="page-title">
            <BlurText text="🎯 Guess the Number" delay={50} />
          </h1>
          <p>A secret number between 1 and 100. Fewer guesses = higher score.</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="game-layout" style={{
          display:             'grid',
          gridTemplateColumns: 'minmax(260px, 300px) 1fr',
          gap:                 '1.25rem',
          alignItems:          'stretch',
        }}>
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {renderStatus()}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--c-text-muted)', marginBottom: '0.25rem' }}>
                  <span>Used: {attemptsUsed}/{maxAttempts}</span>
                  <span>{attemptsLeft} left</span>
                </div>
                <div className="guess-meter">
                  <div className="guess-meter-fill" style={{ width: meterWidth }} />
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <h3 style={{ marginBottom: '0.4rem' }}>How to play</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--c-text-muted)', lineHeight: 1.5 }}>
                Each guess gets a too-high / too-low hint. Solve in fewer attempts for a higher score — every extra guess costs 15 points (floor 10).
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>
              <button
                id="guess-start"
                className="btn btn-primary"
                onClick={startGame}
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading
                  ? <Loader size="sm" color="#fff" />
                  : game ? '🔄 New Game' : '▶ Start Game'}
              </button>
              <Link to="/leaderboard">
                <button className="btn btn-secondary" style={{ width: '100%' }}>🏆 Leaderboard</button>
              </Link>
            </div>
          </aside>

          <section style={{ display: 'flex', alignItems: 'stretch' }}>
            <SpotlightCard
              className="card"
              spotlightColor="rgba(245, 97, 124, 0.1)"
              style={{ padding: '2rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >
              <form onSubmit={submitGuess} className="guess-input-row" aria-disabled={!isActive}>
                <input
                  id="guess-input"
                  className="input"
                  type="number"
                  min={1} max={100}
                  value={guessInput}
                  onChange={e => setGuessInput(e.target.value)}
                  placeholder={isActive ? 'Enter 1–100' : 'Press Start Game on the left'}
                  disabled={submitting || !isActive}
                  autoFocus={isActive}
                />
                <button
                  id="guess-submit"
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !isActive || !guessInput}
                  style={{ minWidth: 100 }}
                >
                  {submitting ? <Loader size="sm" color="#fff" /> : 'Guess'}
                </button>
              </form>

              {!game ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--c-text-muted)' }}>
                  <div style={{ fontSize: '4rem', marginBottom: '0.75rem', opacity: 0.55 }}>🎯</div>
                  <p style={{ fontSize: '0.9rem' }}>Your guesses will show up here.</p>
                </div>
              ) : game.guesses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--c-text-muted)', fontSize: '0.9rem' }}>
                  Make your first guess to see hints.
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    Guess history
                  </div>
                  <ul className="guess-history">
                    {[...game.guesses].reverse().map((g, i) => (
                      <li key={i}>
                        <span style={{ fontWeight: 700 }}>{g.value}</span>
                        <span className={`hint-${g.hint}`}>{hintLabel(g.hint)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {game?.gameId && (
                <p style={{ textAlign: 'center', marginTop: 'auto', fontSize: '0.7rem', color: 'var(--c-text-muted)' }}>
                  Game ID: {game.gameId.slice(0, 8)}…
                </p>
              )}
            </SpotlightCard>
          </section>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .game-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
