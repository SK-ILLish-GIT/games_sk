import React from 'react';
import { Link } from 'react-router-dom';

const GAMES = [
  {
    id: 'tic-tac-toe',
    emoji: '⭕',
    title: 'Tic-Tac-Toe',
    description: 'Classic X vs O — claim 3 in a row to win. Fast rounds, pure strategy.',
    badge: 'Classic',
    badgeClass: 'badge-accent',
    path: '/tic-tac-toe',
  },
  {
    id: 'guess-number',
    emoji: '🎯',
    title: 'Guess the Number',
    description: 'A secret number between 1–100. Use fewer guesses to score higher.',
    badge: 'Solo',
    badgeClass: 'badge-orange',
    path: '/guess-number',
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="container">
          <p className="badge badge-accent" style={{ marginBottom: '1rem' }}>🎮 Platform v2 — Now with Leaderboards</p>
          <h1>Play. <span className="gradient-text">Compete.</span> Win.</h1>
          <p className="hero-subtitle">
            A microservices gaming platform — each game is an independent service,<br />
            all connected through a global leaderboard.
          </p>
        </div>
      </section>

      {/* Games */}
      <section className="page" style={{ paddingTop: '1rem' }}>
        <div className="container">
          <div className="page-header">
            <div>
              <h2>Available Games</h2>
              <p>Pick a game and climb the ranks</p>
            </div>
            <Link to="/leaderboard" className="btn btn-secondary">🏆 Global Leaderboard</Link>
          </div>

          <div className="game-grid">
            {GAMES.map((game) => (
              <Link key={game.id} to={game.path} className="game-card">
                <div className="game-card-cover" style={{ fontSize: '4.5rem' }}>{game.emoji}</div>
                <div className="game-card-body">
                  <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h3 className="game-card-title">{game.title}</h3>
                    <span className={`badge ${game.badgeClass}`}>{game.badge}</span>
                  </div>
                  <p className="game-card-desc">{game.description}</p>
                  <div style={{ marginTop: '1rem' }}>
                    <span className="btn btn-primary btn-sm">Play Now →</span>
                  </div>
                </div>
              </Link>
            ))}

            {/* Coming soon card */}
            <div className="game-card" style={{ opacity: 0.5, cursor: 'default' }}>
              <div className="game-card-cover">🐍</div>
              <div className="game-card-body">
                <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 className="game-card-title">Snake</h3>
                  <span className="badge" style={{ background: 'var(--c-surface2)', color: 'var(--c-text-muted)' }}>Soon</span>
                </div>
                <p className="game-card-desc">Classic snake game — coming in the next release.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture callout */}
      <section style={{ padding: '0 0 4rem' }}>
        <div className="container">
          <div className="card" style={{ background: 'linear-gradient(135deg, rgba(124,110,245,0.1), rgba(245,162,110,0.08))', borderColor: 'rgba(124,110,245,0.3)' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>🏗️ Microservices Architecture</h3>
            <p>Each game runs as an independent Docker container. Auth and leaderboard are platform-level services shared by all games. Redis powers the real-time leaderboard sorted sets with sub-millisecond reads.</p>
            <div className="flex flex-wrap gap-sm" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
              {['Node.js', 'Express', 'PostgreSQL', 'MongoDB', 'Redis', 'React', 'Docker', 'Nginx'].map(t => (
                <span key={t} className="badge badge-accent">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
