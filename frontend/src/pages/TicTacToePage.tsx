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

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '800px' }}>
        <div className="page-header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="page-title">
            <BlurText text="⭕ Tic-Tac-Toe" delay={50} />
          </h1>
          <p>Classic 3×3 strategy. Block your opponent and land three in a row.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {status === TicTacToeUIStatus.Idle && (
          <SpotlightCard className="card" style={{ padding: '2rem', textAlign: 'center' }} spotlightColor="rgba(124, 110, 245, 0.1)">
            <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>⭕</div>
            <p style={{ marginBottom: '1.5rem' }}>Pass the device between two players to take turns.</p>
            <button id="ttt-start" className="btn btn-primary" onClick={startGame} disabled={loading} style={{ minWidth: 140 }}>
              {loading ? <Loader size="sm" color="#fff" className="m-0" /> : 'New Game'}
            </button>
          </SpotlightCard>
        )}

        {(status === TicTacToeUIStatus.Active || status === TicTacToeUIStatus.Finished) && game && (
          <SpotlightCard className="card" style={{ padding: '2rem' }} spotlightColor="rgba(124, 110, 245, 0.1)">
            <div className="ttt-status" style={{ textAlign: 'center', marginBottom: '1rem' }}>
              {game.status === TicTacToeStatus.Active ? (
                <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                  Current Turn: <ShinyText text={`PLAYER ${game.currentPlayer.toUpperCase()}`} speed={3} className={game.currentPlayer === 'X' ? 'ttt-cell x' : 'ttt-cell o'} style={{ display: 'inline', border: 'none', background: 'none' }} />
                </span>
              ) : game.winner && game.winner !== 'draw' ? (
                <StarBorder color={game.winner === 'X' ? 'var(--c-accent)' : 'var(--c-accent2)'} speed="2s" style={{ display: 'inline-block' }}>
                  <div style={{ padding: '0.5rem 2rem', background: 'var(--c-surface)', borderRadius: 'calc(var(--radius-sm) - 1px)', fontSize: '1.25rem', fontWeight: 700 }}>
                    🏆 Winner: <span className={game.winner === 'X' ? 'ttt-cell x' : 'ttt-cell o'} style={{ display: 'inline', border: 'none', background: 'none' }}>{game.winner.toUpperCase()}</span>
                  </div>
                </StarBorder>
              ) : (
                <span className="badge badge-accent" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>🤝 It's a Draw!</span>
              )}
            </div>

            <div className="ttt-board">
              {game.board.map((cell, i) => (
                <button
                  key={i}
                  id={`ttt-cell-${i}`}
                  className={`ttt-cell ${cell?.toLowerCase() || ''}`}
                  onClick={() => makeMove(i)}
                  disabled={!!cell || game.status !== TicTacToeStatus.Active || movePending}
                >
                  {cell || ''}
                </button>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button id="ttt-new" className="btn btn-primary" onClick={startGame} disabled={loading} style={{ minWidth: 140 }}>
                {loading ? <Loader size="sm" color="#fff" className="m-0" /> : '🔄 New Game'}
              </button>
              <Link to="/leaderboard">
                <button className="btn btn-secondary">🏆 Leaderboard</button>
              </Link>
            </div>

            {game.gameId && (
              <p style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--c-text-muted)' }}>
                Game ID: {game.gameId.slice(0, 8)}…
              </p>
            )}
          </SpotlightCard>
        )}
      </div>
    </div>
  );
}
