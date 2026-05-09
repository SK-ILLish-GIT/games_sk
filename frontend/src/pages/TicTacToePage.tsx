import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ticTacToeAPI, getApiErrorMessage } from '../api/client';
import { TicTacToeUIStatus, TicTacToeStatus } from '../enums/game.enum';
import type { TicTacToeGame } from '../types';

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

  const winnerLabel = () => {
    if (!game) return '';
    if (game.winner === 'draw') return "It's a draw! 🤝";
    if (game.winner) return `Player ${game.winner} wins! 🎉`;
    return '';
  };

  const statusLabel = () => {
    if (!game) return '';
    if (game.status === TicTacToeStatus.Finished) return winnerLabel();
    return `Player ${game.currentPlayer}'s turn`;
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <Link to="/" style={{ color: 'var(--c-text-muted)', fontSize: '0.85rem' }}>← Back to Games</Link>
          <h1 style={{ marginTop: '0.75rem' }}>⭕ Tic-Tac-Toe</h1>
          <p>Classic X vs O — two players, one board</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {status === TicTacToeUIStatus.Idle && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>⭕</div>
            <p style={{ marginBottom: '1.5rem' }}>Pass the device between two players to take turns.</p>
            <button id="ttt-start" className="btn btn-primary" onClick={startGame} disabled={loading}>
              {loading ? 'Starting…' : 'New Game'}
            </button>
          </div>
        )}

        {(status === TicTacToeUIStatus.Active || status === TicTacToeUIStatus.Finished) && game && (
          <>
            <div className={`ttt-status ${game.winner && game.winner !== 'draw' ? 'alert alert-success' : ''}`}>
              {statusLabel()}
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
              <button id="ttt-new" className="btn btn-primary" onClick={startGame} disabled={loading}>
                {loading ? '…' : '🔄 New Game'}
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
          </>
        )}
      </div>
    </div>
  );
}
