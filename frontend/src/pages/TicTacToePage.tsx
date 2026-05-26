import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ticTacToeAPI, getApiErrorMessage } from '../api/client';
import { TicTacToeUIStatus, TicTacToeStatus } from '../enums/game.enum';
import type { TicTacToeGame } from '../types';
import BlurText from '../components/ui/BlurText';
import SpotlightCard from '../components/ui/SpotlightCard';
import ShinyText from '../components/ui/ShinyText';
import StarBorder from '../components/ui/StarBorder';
import Loader from '../components/ui/Loader';

type Status   = TicTacToeUIStatus;
type GameState = TicTacToeGame;

export default function TicTacToePage() {
  const [game, setGame] = useState<GameState | null>(null);
  const [status, setStatus] = useState<Status>(TicTacToeUIStatus.Idle);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [movePending, setMovePending] = useState(false);

  const startGame = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await ticTacToeAPI.create();
      setGame(r.data.data);
      setStatus(TicTacToeUIStatus.Active);
    } catch {
      setError('Failed to create game. Is the service running?');
    } finally {
      setLoading(false);
    }
  };

  const makeMove = async (position: number) => {
    if (!game || movePending || game.status !== TicTacToeStatus.Active) return;
    if (game.board[position] !== null) return;
    setMovePending(true);
    try {
      const r = await ticTacToeAPI.move(game.gameId, position);
      const updated = r.data.data as TicTacToeGame;
      setGame(updated);
      if (updated.status === TicTacToeStatus.Finished) setStatus(TicTacToeUIStatus.Finished);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Move failed'));
    } finally {
      setMovePending(false);
    }
  };

  const boardActive = status === TicTacToeUIStatus.Active && game?.status === TicTacToeStatus.Active;
  const displayBoard: (string | null)[] = game?.board ?? Array(9).fill(null);

  const renderStatus = () => {
    if (status === TicTacToeUIStatus.Idle || !game) {
      return (
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
            Status
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600 }}>Press New Game to begin</div>
          <p style={{ fontSize: '0.78rem', color: 'var(--c-text-muted)', marginTop: '0.35rem' }}>
            Pass the device between two players to take turns.
          </p>
        </div>
      );
    }
    if (game.status === TicTacToeStatus.Active) {
      return (
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
            Current turn
          </div>
          <ShinyText
            text={`PLAYER ${game.currentPlayer.toUpperCase()}`}
            speed={3}
            className={game.currentPlayer === 'X' ? 'ttt-cell x' : 'ttt-cell o'}
            style={{ display: 'inline-block', border: 'none', background: 'none', padding: 0, fontSize: '1.4rem', fontWeight: 700 }}
          />
        </div>
      );
    }
    if (game.winner && game.winner !== 'draw') {
      return (
        <StarBorder color={game.winner === 'X' ? 'var(--c-accent)' : 'var(--c-accent2)'} speed="2s" style={{ width: '100%' }}>
          <div style={{ padding: '0.75rem 1rem', background: 'var(--c-surface)', borderRadius: 'calc(var(--radius-sm) - 1px)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Winner
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
              🏆 <span className={game.winner === 'X' ? 'ttt-cell x' : 'ttt-cell o'} style={{ display: 'inline', border: 'none', background: 'none' }}>{game.winner.toUpperCase()}</span>
            </div>
          </div>
        </StarBorder>
      );
    }
    return (
      <div style={{ textAlign: 'center' }}>
        <span className="badge badge-accent" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>🤝 It's a Draw!</span>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 1200 }}>
        <div className="page-header" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 className="page-title">
            <BlurText text="⭕ Tic-Tac-Toe" delay={50} />
          </h1>
          <p>Classic 3×3 strategy. Block your opponent and land three in a row.</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="game-layout" style={{
          display:             'grid',
          gridTemplateColumns: 'minmax(260px, 300px) 1fr',
          gap:                 '1.25rem',
          alignItems:          'stretch',
        }}>
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
              {renderStatus()}
            </div>

            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <h3 style={{ marginBottom: '0.4rem' }}>How to play</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--c-text-muted)', lineHeight: 1.5 }}>
                Tap an empty square on your turn. First player to land three marks in a row — horizontally, vertically, or diagonally — wins. Pass-and-play with a friend on the same device.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>
              <button
                id="ttt-start"
                className="btn btn-primary"
                onClick={startGame}
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading
                  ? <Loader size="sm" color="#fff" className="m-0" />
                  : game ? '🔄 New Game' : '▶ Start Game'}
              </button>
              <Link to="/leaderboard">
                <button className="btn btn-secondary" style={{ width: '100%' }}>🏆 Leaderboard</button>
              </Link>
            </div>
          </aside>

          <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SpotlightCard
              className="card"
              spotlightColor="rgba(124, 110, 245, 0.1)"
              style={{ padding: '2rem', width: '100%' }}
            >
              <div className="ttt-board" style={{ opacity: boardActive ? 1 : 0.55, transition: 'opacity 0.2s' }}>
                {displayBoard.map((cell, i) => (
                  <button
                    key={i}
                    id={`ttt-cell-${i}`}
                    className={`ttt-cell ${(cell ?? '').toLowerCase()}`}
                    onClick={() => makeMove(i)}
                    disabled={!boardActive || !!cell || movePending}
                  >
                    {cell || ''}
                  </button>
                ))}
              </div>

              {!boardActive && (
                <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>
                  {status === TicTacToeUIStatus.Idle
                    ? 'Press Start Game on the left to begin.'
                    : 'Game over — press New Game to play again.'}
                </p>
              )}

              {game?.gameId && (
                <p style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--c-text-muted)' }}>
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
