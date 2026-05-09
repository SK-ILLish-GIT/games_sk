import React, { useEffect, useState } from 'react';
import { leaderboardAPI } from '../api/client';
import type { LeaderboardEntry } from '../types';

const GAMES = ['global', 'tic-tac-toe', 'guess-number'];
const GAME_LABELS: Record<string, string> = {
  global: '🌍 Global',
  'tic-tac-toe': '⭕ Tic-Tac-Toe',
  'guess-number': '🎯 Guess the Number',
};

export default function LeaderboardPage() {
  const [activeGame, setActiveGame] = useState('global');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const call = activeGame === 'global'
      ? leaderboardAPI.getGlobal()
      : leaderboardAPI.getByGame(activeGame);
    call
      .then(r => setEntries(r.data.data as LeaderboardEntry[]))
      .catch(() => setError('Failed to load leaderboard'))
      .finally(() => setLoading(false));
  }, [activeGame]);

  const medalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return String(rank);
  };

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1 className="page-title">🏆 Leaderboard</h1>
            <p>Best scores across every game — compete for the top spot</p>
          </div>
        </div>

        {/* Game selector tabs */}
        <div className="flex gap-sm" style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {GAMES.map(g => (
            <button
              key={g}
              id={`lb-tab-${g}`}
              className={`btn ${activeGame === g ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setActiveGame(g)}
            >
              {GAME_LABELS[g] || g}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          {loading && <div className="spinner" />}
          {error && <div className="alert alert-error" style={{ margin: '1rem' }}>{error}</div>}
          {!loading && !error && entries.length === 0 && (
            <p style={{ padding: '2rem', textAlign: 'center' }}>No scores yet — play a game to appear here!</p>
          )}
          {!loading && entries.length > 0 && (
            <table className="lb-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>#</th>
                  <th>Player</th>
                  <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.userId}>
                    <td className={`lb-rank ${e.rank <= 3 ? `lb-rank-${e.rank}` : ''}`}>
                      {medalEmoji(e.rank)}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{e.username}</span>
                    </td>
                    <td className="lb-score">{e.score.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
