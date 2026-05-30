import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { hangmanAPI, getApiErrorMessage } from '../api/client';
import { HangmanStatus, HangmanDifficulty } from '../enums/game.enum';
import type { HangmanGame } from '../types';
import BlurText from '../components/ui/BlurText';
import SpotlightCard from '../components/ui/SpotlightCard';
import StarBorder from '../components/ui/StarBorder';
import Loader from '../components/ui/Loader';
import HangmanFigure from '../components/hangman/HangmanFigure';
import HangmanGuessStrip from '../components/hangman/HangmanGuessStrip';
import Squares from '../components/ui/Squares';

type GameState = HangmanGame;

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

const DIFFICULTY_OPTIONS: { id: HangmanDifficulty; label: string; hint: string }[] = [
  { id: HangmanDifficulty.Easy,   label: 'Easy',   hint: 'Short, common words' },
  { id: HangmanDifficulty.Medium, label: 'Medium', hint: 'Balanced challenge'    },
  { id: HangmanDifficulty.Hard,   label: 'Hard',   hint: 'Longer, tougher words' },
];

export default function HangmanPage() {
  const [game, setGame]               = useState<GameState | null>(null);
  const [difficulty, setDifficulty]   = useState<HangmanDifficulty>(HangmanDifficulty.Medium);
  const [loading, setLoading]         = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState('');

  const maxWrong     = game?.maxWrong ?? 6;
  const wrongGuesses = game?.wrongGuesses ?? 0;
  const attemptsLeft = Math.max(0, maxWrong - wrongGuesses);
  const meterWidth   = `${Math.min(100, (wrongGuesses / maxWrong) * 100)}%`;
  const isLost       = game?.status === HangmanStatus.Lost;
  const isActive     = game?.status === HangmanStatus.Active;
  const canPickDifficulty = !game || !isActive;

  const startGame = async (level: HangmanDifficulty = difficulty) => {
    setLoading(true);
    setError('');
    try {
      const r = await hangmanAPI.create(level);
      setGame(r.data.data as GameState);
    } catch {
      setError('Failed to start game. Is the service running?');
    } finally {
      setLoading(false);
    }
  };

  const guessLetter = async (letter: string) => {
    if (!game || game.status !== HangmanStatus.Active) return;
    if (game.guessedLetters.includes(letter)) return;
    setSubmitting(true);
    setError('');
    try {
      const r = await hangmanAPI.guessLetter(game.gameId, letter);
      setGame(r.data.data as GameState);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Guess failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatus = () => {
    if (!game) {
      return (
        <>
          <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
            Status
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600 }}>Press Start Game to begin</div>
          <p style={{ fontSize: '0.78rem', color: 'var(--c-text-muted)', marginTop: '0.35rem' }}>
            6 wrong guesses allowed. Harder words score higher.
          </p>
        </>
      );
    }
    if (game.status === HangmanStatus.Won) {
      return (
        <StarBorder color="var(--c-green)" speed="3s" style={{ width: '100%' }}>
          <div style={{ padding: '0.85rem 1rem', background: 'var(--c-surface)', borderRadius: 'calc(var(--radius-sm) - 1px)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Solved
            </div>
            <div style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>
              🎉 {wrongGuesses} wrong guess{wrongGuesses !== 1 ? 'es' : ''}
            </div>
            {game.word && (
              <div style={{ fontSize: '0.9rem', color: 'var(--c-text-muted)' }}>
                Word: <strong style={{ color: 'var(--c-text)' }}>{game.word}</strong>
              </div>
            )}
          </div>
        </StarBorder>
      );
    }
    if (game.status === HangmanStatus.Lost) {
      return (
        <div className="alert alert-error" style={{ textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
            Out of attempts
          </div>
          <div style={{ fontSize: '0.95rem' }}>
            😔 The word was <strong>{game.word ?? '???'}</strong>
          </div>
        </div>
      );
    }
    return (
      <>
        <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
          Wrong guesses
        </div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1 }}>
          {attemptsLeft}<span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--c-text-muted)' }}> / {maxWrong} left</span>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--c-text-muted)', marginTop: '0.35rem', textTransform: 'capitalize' }}>
          {game.difficulty} · {game.maskedWord.length} letters
        </p>
      </>
    );
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 1200 }}>
        <div className="page-header" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 className="page-title">
            <BlurText text="🪢 Hangman" delay={50} />
          </h1>
          <p>Guess the word one letter at a time. 6 wrong guesses and you’re out.</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="game-layout" style={{
          display:             'grid',
          gridTemplateColumns: 'minmax(260px, 300px) 1fr',
          gap:                 '1.25rem',
          alignItems:          'stretch',
        }}>
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 640 }}>
            <div className="card" style={{ padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {renderStatus()}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--c-text-muted)', marginBottom: '0.25rem' }}>
                  <span>Used: {wrongGuesses}/{maxWrong}</span>
                  <span>{attemptsLeft} left</span>
                </div>
                <div className="guess-meter" style={{ margin: 0 }}>
                  <div className="guess-meter-fill" style={{ width: meterWidth }} />
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <h3 style={{ marginBottom: '0.4rem' }}>How to play</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--c-text-muted)', lineHeight: 1.5 }}>
                Tap one letter at a time to reveal the hidden word. Each wrong letter costs one of your 6 lives.
              </p>
            </div>

            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <h3 style={{ marginBottom: '0.65rem' }}>Difficulty</h3>
              <div className="hangman-difficulty-stack">
                {DIFFICULTY_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    id={`hm-difficulty-${opt.id}`}
                    type="button"
                    className={`btn btn-sm hangman-difficulty-btn ${difficulty === opt.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setDifficulty(opt.id)}
                    disabled={!canPickDifficulty || loading}
                  >
                    <span>{opt.label}</span>
                    <span className="hangman-difficulty-hint">{opt.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>
              <button
                id="hm-start"
                className="btn btn-primary"
                onClick={() => startGame()}
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

          <section style={{ display: 'flex', alignItems: 'stretch', minHeight: 640 }}>
            <SpotlightCard
              className="card guess-play-panel"
              spotlightColor="rgba(129, 140, 248, 0.12)"
              style={{ padding: '2rem', width: '100%', display: 'flex', flexDirection: 'column' }}
            >
              {!game ? (
                <div className="hangman-play-empty">
                  <HangmanFigure wrongGuesses={0} variant="preview" />
                  <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Pick a difficulty and press Start Game.</p>
                </div>
              ) : (
                <div className="hangman-play-body">
                  <div className="hangman-board">
                    <HangmanFigure
                      wrongGuesses={wrongGuesses}
                      maxWrong={maxWrong}
                      isLost={isLost}
                    />

                    <div className="hangman-board-main">
                      <div className="hangman-word-panel">
                        <div className="hangman-word">
                          {game.maskedWord.split('').map((ch, i) => (
                            <span key={i} className={`hangman-letter ${ch === '_' ? 'is-blank' : 'is-revealed'}`}>
                              {ch === '_' ? '\u00A0' : ch}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="hangman-keyboard-wrap">
                        <div className="hangman-keyboard">
                          {ALPHABET.map(letter => {
                            const tried  = game.guessedLetters.includes(letter);
                            const inWord = tried && game.maskedWord.includes(letter);
                            const cls = tried
                              ? (inWord ? 'hangman-key is-correct' : 'hangman-key is-wrong')
                              : 'hangman-key';
                            return (
                              <button
                                key={letter}
                                id={`hm-key-${letter}`}
                                type="button"
                                className={cls}
                                disabled={tried || submitting || !isActive}
                                onClick={() => guessLetter(letter)}
                              >
                                {letter}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="hangman-guess-compact">
                        <div className="hangman-guess-compact-head">
                          <span className="hangman-history-title">Guessed letters</span>
                          <span className="hangman-guess-legend">
                            <span className="hangman-guess-legend-item is-hit">in word</span>
                            <span className="hangman-guess-legend-item is-miss">wrong</span>
                          </span>
                        </div>
                        <HangmanGuessStrip guesses={game.guesses} />
                      </div>
                    </div>
                  </div>

                  {game.gameId && (
                    <p className="hangman-game-id">
                      Game ID: {game.gameId.slice(0, 8)}…
                    </p>
                  )}
                </div>
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
