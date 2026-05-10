import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { hangmanAPI, getApiErrorMessage } from '../api/client';
import { HangmanStatus, HangmanDifficulty } from '../enums/game.enum';
import type { HangmanGame, HangmanGuessRecord } from '../types';
import BlurText from '../components/ui/BlurText';
import SpotlightCard from '../components/ui/SpotlightCard';
import StarBorder from '../components/ui/StarBorder';
import Loader from '../components/ui/Loader';

type GameState = HangmanGame;

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

const DIFFICULTY_OPTIONS: { id: HangmanDifficulty; label: string }[] = [
  { id: HangmanDifficulty.Easy,   label: 'Easy'   },
  { id: HangmanDifficulty.Medium, label: 'Medium' },
  { id: HangmanDifficulty.Hard,   label: 'Hard'   },
];

export default function HangmanPage() {
  const [game, setGame]               = useState<GameState | null>(null);
  const [difficulty, setDifficulty]   = useState<HangmanDifficulty>(HangmanDifficulty.Medium);
  const [wordGuess, setWordGuess]     = useState('');
  const [loading, setLoading]         = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState('');

  const startGame = async (level: HangmanDifficulty = difficulty) => {
    setLoading(true);
    setError('');
    try {
      const r = await hangmanAPI.create(level);
      setGame(r.data.data as GameState);
      setWordGuess('');
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

  const submitWordGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!game || !wordGuess.trim() || game.status !== HangmanStatus.Active) return;
    setSubmitting(true);
    setError('');
    try {
      const r = await hangmanAPI.guessWord(game.gameId, wordGuess.trim());
      setGame(r.data.data as GameState);
      setWordGuess('');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Guess failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const attemptsLeft = game ? Math.max(0, game.maxWrong - game.wrongGuesses) : 0;
  const meterWidth   = game ? `${(game.wrongGuesses / game.maxWrong) * 100}%` : '0%';

  const renderGuessRow = (g: HangmanGuessRecord, key: number | string) => {
    if (g.kind === 'letter') {
      const { occurrences, positions } = g.feedback;
      return (
        <li key={key} className="hangman-guess">
          <span className="hangman-guess-letter">{g.value.toUpperCase()}</span>
          {occurrences > 0 ? (
            <span className="hangman-guess-detail hint-correct">
              ✓ {occurrences} {occurrences === 1 ? 'match' : 'matches'} at position{positions.length === 1 ? '' : 's'} {positions.map(p => p + 1).join(', ')}
            </span>
          ) : (
            <span className="hangman-guess-detail hint-too-high">✗ not in word</span>
          )}
        </li>
      );
    }
    const { perPosition, correctPositions, presentLetters } = g.feedback;
    return (
      <li key={key} className="hangman-guess hangman-guess-word">
        <div className="hangman-guess-chips">
          {perPosition.map((status, i) => (
            <span key={i} className={`hangman-chip is-${status}`}>{g.value[i]?.toUpperCase()}</span>
          ))}
        </div>
        <span className="hangman-guess-detail">
          {g.correct
            ? <span className="hint-correct">✓ exact match</span>
            : <>{correctPositions} correct · {presentLetters} misplaced</>}
        </span>
      </li>
    );
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '800px' }}>
        <div className="page-header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="page-title">
            <BlurText text="🪢 Hangman" delay={50} />
          </h1>
          <p>Guess the word one letter at a time. 6 wrong guesses and you’re out.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {!game && (
          <SpotlightCard className="card" style={{ padding: '2rem', textAlign: 'center' }} spotlightColor="rgba(129, 140, 248, 0.12)">
            <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🪢</div>
            <p style={{ marginBottom: '0.5rem' }}>6 wrong guesses allowed.</p>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>
              Each wrong guess costs 10 points · harder words score higher
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--c-text-muted)', marginBottom: '0.5rem' }}>Choose difficulty</p>
              <div className="flex gap-sm" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                {DIFFICULTY_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    id={`hm-difficulty-${opt.id}`}
                    type="button"
                    className={`btn btn-sm ${difficulty === opt.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setDifficulty(opt.id)}
                    style={{ minWidth: 90 }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              id="hm-start"
              className="btn btn-primary"
              onClick={() => startGame()}
              disabled={loading}
              style={{ minWidth: 140 }}
            >
              {loading ? <Loader size="sm" color="#fff" /> : 'Start Game'}
            </button>
          </SpotlightCard>
        )}

        {game && (
          <SpotlightCard className="card" style={{ padding: '2rem' }} spotlightColor="rgba(129, 140, 248, 0.12)">
            {/* Status banner */}
            {game.status === HangmanStatus.Won && (
              <StarBorder color="var(--c-green)" speed="3s" style={{ width: '100%', marginBottom: '1.5rem' }}>
                <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--c-surface)', borderRadius: 'calc(var(--radius-sm) - 1px)' }}>
                  <div style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                    🎉 You got it with {game.wrongGuesses} wrong guess{game.wrongGuesses !== 1 ? 'es' : ''}!
                  </div>
                  {game.word && (
                    <div style={{ fontSize: '0.95rem', color: 'var(--c-text-muted)' }}>
                      The word was <strong style={{ color: 'var(--c-text)' }}>{game.word}</strong>
                    </div>
                  )}
                </div>
              </StarBorder>
            )}
            {game.status === HangmanStatus.Lost && (
              <div className="alert alert-error" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                😔 Out of attempts! The word was <strong>{game.word ?? '???'}</strong>.
              </div>
            )}

            {/* Wrong-guess meter */}
            <div style={{ marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>
              <span>Wrong guesses: {game.wrongGuesses}/{game.maxWrong}</span>
              <span>{attemptsLeft} left · {game.difficulty}</span>
            </div>
            <div className="guess-meter" style={{ marginBottom: '1.5rem' }}>
              <div className="guess-meter-fill" style={{ width: meterWidth }} />
            </div>

            {/* Masked word */}
            <div className="hangman-word">
              {game.maskedWord.split('').map((ch, i) => (
                <span key={i} className={`hangman-letter ${ch === '_' ? 'is-blank' : ''}`}>
                  {ch === '_' ? '\u00A0' : ch}
                </span>
              ))}
            </div>

            {/* On-screen keyboard */}
            <div className="hangman-keyboard">
              {ALPHABET.map(letter => {
                const tried   = game.guessedLetters.includes(letter);
                const inWord  = tried && game.maskedWord.includes(letter);
                const wrong   = tried && !inWord;
                const cls = tried
                  ? (inWord ? 'hangman-key is-correct' : 'hangman-key is-wrong')
                  : 'hangman-key';
                return (
                  <button
                    key={letter}
                    id={`hm-key-${letter}`}
                    type="button"
                    className={cls}
                    disabled={tried || submitting || game.status !== HangmanStatus.Active}
                    onClick={() => guessLetter(letter)}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            {/* Full-word guess */}
            {game.status === HangmanStatus.Active && (
              <form onSubmit={submitWordGuess} className="guess-input-row" style={{ marginTop: '1.5rem' }}>
                <input
                  id="hm-word-input"
                  className="input"
                  type="text"
                  value={wordGuess}
                  maxLength={game.maskedWord.length}
                  onChange={e => setWordGuess(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, game.maskedWord.length))}
                  placeholder={`Guess the full word (${game.maskedWord.length} letters)`}
                  disabled={submitting}
                  autoComplete="off"
                />
                <button
                  id="hm-word-submit"
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || wordGuess.length !== game.maskedWord.length}
                  style={{ minWidth: 90 }}
                >
                  {submitting ? <Loader size="sm" color="#fff" /> : 'Solve'}
                </button>
              </form>
            )}

            {/* Guess history */}
            {game.guesses.length > 0 && (
              <div className="hangman-history-wrap">
                <h4 className="hangman-history-title">Guess history</h4>
                <ul className="hangman-history">
                  {[...game.guesses].reverse().map((g, i) => renderGuessRow(g, i))}
                </ul>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '2rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button id="hm-new" className="btn btn-primary" onClick={() => startGame()} disabled={loading} style={{ minWidth: 140 }}>
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
