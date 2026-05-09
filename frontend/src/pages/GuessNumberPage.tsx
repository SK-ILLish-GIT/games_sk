import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { guessAPI, getApiErrorMessage } from '../api/client';
import { GuessStatus, Hint } from '../enums/game.enum';
import type { GuessNumberGame, GuessEntry } from '../types';
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

  const meterWidth = game ? `${(game.attempts / game.maxAttempts) * 100}%` : '0%';
  const attemptsLeft = game ? game.maxAttempts - game.attempts : 7;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '800px' }}>
        <div className="page-header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="page-title">
            <BlurText text="🎯 Guess the Number" delay={50} />
          </h1>
          <p>A secret number between 1 and 100. Fewer guesses = higher score.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {!game && (
          <SpotlightCard className="card" style={{ padding: '2rem', textAlign: 'center' }} spotlightColor="rgba(245, 97, 124, 0.1)">
            <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🎯</div>
            <p style={{ marginBottom: '0.5rem' }}>7 attempts. Score up to 100 points.</p>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>Each extra attempt costs 15 points.</p>
            <button id="guess-start" className="btn btn-primary" onClick={startGame} disabled={loading} style={{ minWidth: 140 }}>
              {loading ? <Loader size="sm" color="#fff" /> : 'Start Game'}
            </button>
          </SpotlightCard>
        )}

        {game && (
          <SpotlightCard className="card" style={{ padding: '2rem' }} spotlightColor="rgba(245, 97, 124, 0.1)">
            {/* Status banner */}
            {game.status === GuessStatus.Won && (
              <StarBorder color="var(--c-green)" speed="3s" style={{ width: '100%', marginBottom: '1.5rem' }}>
                <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--c-surface)', borderRadius: 'calc(var(--radius-sm) - 1px)' }}>
                  <div style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>🎉 You guessed it in {game.attempts} attempt{game.attempts !== 1 ? 's' : ''}!</div>
                  <div style={{ fontSize: '1.25rem' }}>Score: <strong style={{ color: 'var(--c-green)' }}>{Math.max(10, 100 - (game.attempts - 1) * 15)}</strong></div>
                </div>
              </StarBorder>
            )}
            {game.status === GuessStatus.Lost && (
              <div className="alert alert-error" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                😔 Out of attempts! Better luck next time.
              </div>
            )}

            {/* Attempts meter */}
            <div style={{ marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>
              <span>Attempts used: {game.attempts}/{game.maxAttempts}</span>
              <span>{attemptsLeft} left</span>
            </div>
            <div className="guess-meter" style={{ marginBottom: '1.5rem' }}>
              <div className="guess-meter-fill" style={{ width: meterWidth }} />
            </div>

            {/* Input */}
            {game.status === GuessStatus.Active && (
              <form onSubmit={submitGuess} className="guess-input-row">
                <input
                  id="guess-input"
                  className="input"
                  type="number"
                  min={1} max={100}
                  value={guessInput}
                  onChange={e => setGuessInput(e.target.value)}
                  placeholder="Enter 1–100"
                  disabled={submitting}
                  autoFocus
                />
                <button id="guess-submit" type="submit" className="btn btn-primary" disabled={submitting || !guessInput} style={{ minWidth: 90 }}>
                  {submitting ? <Loader size="sm" color="#fff" /> : 'Guess'}
                </button>
              </form>
            )}

            {/* Guess history */}
            {game.guesses.length > 0 && (
              <ul className="guess-history">
                {[...game.guesses].reverse().map((g, i) => (
                  <li key={i}>
                    <span style={{ fontWeight: 700 }}>{g.value}</span>
                    <span className={`hint-${g.hint}`}>{hintLabel(g.hint)}</span>
                  </li>
                ))}
              </ul>
            )}

            <div style={{ textAlign: 'center', marginTop: '2rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button id="guess-new" className="btn btn-primary" onClick={startGame} disabled={loading} style={{ minWidth: 140 }}>
                {loading ? <Loader size="sm" color="#fff" /> : '🔄 New Game'}
              </button>
              <Link to="/leaderboard">
                <button className="btn btn-secondary">🏆 Leaderboard</button>
              </Link>
            </div>
          </SpotlightCard>
        )}
      </div>
    </div>
  );
}
