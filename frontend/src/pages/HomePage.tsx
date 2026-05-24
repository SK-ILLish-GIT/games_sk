import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SpotlightCard from '../components/ui/SpotlightCard';
import ShinyText from '../components/ui/ShinyText';
import Squares from '../components/ui/Squares';

const GAMES = [
  {
    id: 'tic-tac-toe',
    emoji: '⭕',
    title: 'Tic-Tac-Toe',
    description: 'Classic 3×3 strategy. Place your mark, block your opponent, land three in a row. Fast, sharp, no luck.',
    badge: 'Classic',
    badgeClass: 'badge-accent',
    path: '/tic-tac-toe',
  },
  {
    id: 'guess-number',
    emoji: '🎯',
    title: 'Guess the Number',
    description: 'Crack a secret number between 1 and 100 in 7 tries. Every wrong guess costs — score higher by solving it faster.',
    badge: 'Solo',
    badgeClass: 'badge-orange',
    path: '/guess-number',
  },
  {
    id: 'hangman',
    emoji: '🪢',
    title: 'Hangman',
    description: 'Guess the hidden word one letter at a time. Six wrong guesses and the round is over — pick easy, medium, or hard.',
    badge: 'Word',
    badgeClass: 'badge-accent',
    path: '/hangman',
  },
  {
    id: 'flappy-bird',
    emoji: '🐤',
    title: 'Flappy Bird',
    description: 'Funky modes, unlockable skins, particle trails, daily-seed runs, and server-validated scores. Tap to flap.',
    badge: 'New',
    badgeClass: 'badge-orange',
    path: '/flappy-bird',
  },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <>
      {/* Hero */}
      <section className="hero" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.08, pointerEvents: 'none' }}>
          <Squares 
            direction="diagonal"
            speed={0.5}
            squareSize={50}
            borderColor="var(--c-border)" 
            hoverFillColor="var(--c-surface2)"
          />
        </div>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <p className="badge badge-accent" style={{ marginBottom: '1rem' }}>🎮 GameVault — Microservices Platform</p>
          <h1>Play. <ShinyText text="Compete." speed={3} className="gradient-text" /> Win.</h1>
          <p className="hero-subtitle">
            Pick a game, set a high score, and fight for the top spot on the global leaderboard.
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
              <SpotlightCard 
                key={game.id} 
                spotlightColor="var(--c-accent-glow)" 
                className="game-card" 
                onClick={() => navigate(game.path)}
                style={{ padding: 0 }}
              >
                <div className="game-card-cover" style={{ fontSize: '4.5rem' }}>{game.emoji}</div>
                <div className="game-card-body">
                  <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h3 className="game-card-title">{game.title}</h3>
                    <span className={`badge ${game.badgeClass}`}>{game.badge}</span>
                  </div>
                  <p className="game-card-desc">{game.description}</p>
                  <div style={{ marginTop: '1rem' }}>
                    <span className="btn btn-primary btn-sm" style={{ width: '100%' }}>Play Now →</span>
                  </div>
                </div>
              </SpotlightCard>
            ))}

          </div>
        </div>
      </section>

      {/* Architecture callout */}
      <section style={{ padding: '0 0 4rem' }}>
        <div className="container">
          <div className="card" style={{ background: 'linear-gradient(135deg, rgba(124,110,245,0.1), rgba(245,162,110,0.08))', borderColor: 'rgba(124,110,245,0.3)' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>🏗️ Built on Microservices</h3>
            <p>
              Every game runs as an isolated Docker container with its own database and cache.
              A shared Auth service handles identity and JWT issuance. The Leaderboard service
              aggregates scores across all games using Redis Sorted Sets for sub-millisecond ranking.
            </p>
            <div className="flex flex-wrap gap-sm" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
              {['Node.js', 'Express', 'PostgreSQL', 'MongoDB', 'Redis', 'React', 'Docker', 'Nginx'].map(t => (
                <span key={t} className="badge badge-accent">{t}</span>
              ))}
            </div>
            <div style={{ marginTop: '1.25rem' }}>
              <Link to="/architecture" className="btn btn-secondary btn-sm">View Architecture →</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
