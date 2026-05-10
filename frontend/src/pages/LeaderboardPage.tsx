import React, { useEffect, useState } from 'react';
import { leaderboardAPI } from '../api/client';
import type { LeaderboardEntry } from '../types';
import BlurText from '../components/ui/BlurText';
import SpotlightCard from '../components/ui/SpotlightCard';
import StarBorder from '../components/ui/StarBorder';
import Loader from '../components/ui/Loader';

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
        <div className="page-header" style={{ marginBottom: '3rem' }}>
          <div>
            <h1 className="page-title">
              <BlurText text="🏆 Global Leaderboard" delay={100} />
            </h1>
            <p style={{ marginTop: '0.5rem', fontSize: '1.1rem' }}>Best scores across every game — compete for the top spot</p>
          </div>
        </div>

        {/* Game selector tabs */}
        <div className="flex gap-sm" style={{ marginBottom: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {GAMES.map(g => {
            const isActive = activeGame === g;
            const btn = (
              <button
                key={g}
                id={`lb-tab-${g}`}
                className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setActiveGame(g)}
                style={{
                  borderRadius: isActive ? 'calc(var(--radius-sm) - 1px)' : 'var(--radius-sm)',
                  whiteSpace: 'nowrap',
                  boxShadow: 'none',
                }}
              >
                {GAME_LABELS[g] || g}
              </button>
            );

            return isActive ? (
              <StarBorder key={g} color="var(--c-accent)" speed="3s" style={{ borderRadius: 'var(--radius-sm)' }}>
                {btn}
              </StarBorder>
            ) : btn;
          })}
        </div>

        <SpotlightCard className="card" style={{ padding: '0', overflow: 'hidden' }} spotlightColor="rgba(232, 223, 210, 0.14)">
          {loading && <Loader />}
          {error && <div className="alert alert-error" style={{ margin: '1rem' }}>{error}</div>}
          {!loading && !error && entries.length === 0 && (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--c-text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🎮</div>
              <p>No scores yet — play a game to appear here!</p>
            </div>
          )}
          {!loading && entries.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="lb-table">
                <thead>
                  <tr>
                    <th style={{ width: 80, textAlign: 'center' }}>Rank</th>
                    <th>Player</th>
                    <th style={{ textAlign: 'right', paddingRight: '1.5rem' }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.userId} className="lb-row">
                      <td className={`lb-rank ${e.rank <= 3 ? `lb-rank-${e.rank}` : ''}`} style={{ textAlign: 'center' }}>
                        {medalEmoji(e.rank)}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{e.username}</span>
                      </td>
                      <td className="lb-score" style={{ paddingRight: '1.5rem' }}>{e.score.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SpotlightCard>
      </div>
    </div>
  );
}
