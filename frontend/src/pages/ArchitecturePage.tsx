import React, { useState } from 'react';

/* ─────────────────────────────────────────────────────
   Data
───────────────────────────────────────────────────── */

const TECH_STACK = [
  {
    icon: '⚙️',
    name: 'Node.js + Express',
    role: 'API Runtime',
    desc: 'Every backend service is a lightweight Express server running on Node.js with TypeScript. Async route handlers are wrapped so uncaught errors are forwarded to a single global error handler.',
  },
  {
    icon: '🐘',
    name: 'PostgreSQL + Prisma',
    role: 'Relational Store',
    desc: 'Users, hashed passwords, and refresh tokens live in Postgres. Prisma ORM generates type-safe query builders and handles schema migrations through the auth-service on startup.',
  },
  {
    icon: '🍃',
    name: 'MongoDB + Mongoose',
    role: 'Game State Store',
    desc: 'Each game session — board state, move history, timestamps — is stored as a flexible document in MongoDB. Its schema-less nature makes it easy to evolve the game data model independently.',
  },
  {
    icon: '⚡',
    name: 'Redis',
    role: 'Cache & Leaderboard',
    desc: 'Game state is cached with a 1-hour TTL for sub-millisecond reads. The leaderboard uses Redis Sorted Sets with a Lua script to only update a user\'s rank if their new score beats their personal best.',
  },
  {
    icon: '🔐',
    name: 'JWT Auth',
    role: 'Identity & Security',
    desc: 'Short-lived access tokens (15 min) pair with long-lived refresh tokens (7 days) stored hashed in Postgres and mirrored to Redis for instant revocation. Rotation is performed on every refresh call.',
  },
  {
    icon: '🐳',
    name: 'Docker + Nginx',
    role: 'Orchestration & Gateway',
    desc: 'Every service runs as an isolated container with its own Dockerfile. Nginx acts as a reverse proxy and routes requests to the correct upstream service by path prefix, with no ports exposed externally.',
  },
  {
    icon: '⚛️',
    name: 'React + Vite',
    role: 'Frontend',
    desc: 'A single-page React app built with Vite. JWT tokens are stored in memory via a Context provider — no localStorage — and refreshed silently on 401 responses via an Axios interceptor.',
  },
];

const SERVICES = [
  {
    name: 'auth-service',
    port: '3001',
    db: 'PostgreSQL + Redis',
    color: '#7c6ef5',
    icon: '🔐',
    desc: 'Registration, login, token refresh, logout, and JWT verification endpoint used by all services.',
    endpoints: ['POST /register', 'POST /login', 'POST /refresh', 'POST /logout', 'GET /verify', 'GET /me'],
  },
  {
    name: 'leaderboard-service',
    port: '3002',
    db: 'PostgreSQL + Redis',
    color: '#f5a26e',
    icon: '🏆',
    desc: 'Accepts score submissions from game services and serves ranked leaderboards per-game and globally.',
    endpoints: ['POST /scores', 'GET /leaderboard/global', 'GET /leaderboard/:gameId', 'GET /leaderboard/:gameId/me'],
  },
  {
    name: 'tic-tac-toe-service',
    port: '3003',
    db: 'MongoDB + Redis',
    color: '#4edb8c',
    icon: '⭕',
    desc: 'Manages Tic-Tac-Toe game sessions. Enforces move rules via a pure game engine and submits scores on game completion.',
    endpoints: ['POST /games', 'GET /games/:id', 'POST /games/:id/move'],
  },
  {
    name: 'guess-number-service',
    port: '3004',
    db: 'MongoDB + Redis',
    color: '#f5617c',
    icon: '🎯',
    desc: 'Runs Guess-the-Number sessions. The secret is never sent to the client — only hints. Scores reward guessing in fewer attempts.',
    endpoints: ['POST /games', 'GET /games/:id', 'POST /games/:id/guess'],
  },
];

const DESIGN_DECISIONS = [
  {
    title: 'Redis as Write-Through Cache',
    icon: '⚡',
    body: `Game state is written to both MongoDB and Redis on every move. Reads always check Redis first — if it's warm (1-hour TTL), MongoDB is never touched. This means typical game interactions run at cache speed.`,
  },
  {
    title: 'Hashed Refresh Tokens',
    icon: '🔑',
    body: `Refresh tokens are stored as SHA-256 hashes in Postgres, not as raw values. Even if the database were compromised, an attacker cannot use the stored hashes to authenticate. The raw token is returned once and never stored.`,
  },
  {
    title: 'Lua Script for Max-Score Leaderboard',
    icon: '📊',
    body: `A Redis Lua script atomically updates a user's rank only if the new score exceeds their current best. This makes the leaderboard eventually-consistent with each game result — no batch jobs required.`,
  },
  {
    title: 'Score Submission is Fire-and-Forget',
    icon: '🚀',
    body: `Game services POST scores to the leaderboard service without awaiting the response. If the leaderboard is temporarily unavailable, it degrades gracefully — the game still completes, and the failure is logged as a warning.`,
  },
  {
    title: 'JWT Verification Without a DB Round-Trip',
    icon: '🛡️',
    body: `Each service verifies JWTs locally using the shared JWT_SECRET — no network hop to the auth-service. Only the /verify endpoint exists for services that need the decoded payload but didn't receive the token directly.`,
  },
  {
    title: 'Per-Service Config Modules',
    icon: '🗂️',
    body: `Each service has a single src/config/index.ts that reads all environment variables once, applies safe defaults, and exports a typed config object. No file reads process.env directly — everything goes through config.`,
  },
];

/* ─────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: 'var(--c-accent)',
      marginBottom: '0.5rem',
    }}>
      {children}
    </p>
  );
}

function DiagramBox({
  icon, label, sub, color, onClick, active,
}: { icon: string; label: string; sub?: string; color: string; onClick?: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
        background: active ? `${color}22` : 'var(--c-surface2)',
        border: `2px solid ${active ? color : 'var(--c-border)'}`,
        borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease', minWidth: 110, textAlign: 'center',
        boxShadow: active ? `0 0 18px ${color}44` : 'none',
        fontFamily: 'var(--font)',
      }}
    >
      <span style={{ fontSize: '1.8rem' }}>{icon}</span>
      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: active ? color : 'var(--c-text)', whiteSpace: 'nowrap' }}>{label}</span>
      {sub && <span style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)' }}>{sub}</span>}
    </button>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--c-text-muted)', gap: '0.1rem', flexShrink: 0 }}>
      <span style={{ fontSize: '0.65rem', letterSpacing: '0.05em', color: 'var(--c-text-muted)' }}>{label}</span>
      <span style={{ fontSize: '1.1rem' }}>→</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Main Page
───────────────────────────────────────────────────── */

export default function ArchitecturePage() {
  const [activeService, setActiveService] = useState<string | null>(null);
  const selected = SERVICES.find(s => s.name === activeService);

  return (
    <div className="page">
      <div className="container">

        {/* ── Header ── */}
        <div style={{ marginBottom: '3rem' }}>
          <SectionLabel>System Design</SectionLabel>
          <h1 className="page-title">Platform Architecture</h1>
          <p style={{ maxWidth: 640, marginTop: '0.5rem' }}>
            A production-style microservices platform where each game is a fully
            independent service — isolated deployment, separate database, its own cache.
            Shared Auth and Leaderboard services provide identity and cross-game ranking.
          </p>
        </div>

        {/* ── Architecture Diagram ── */}
        <div className="card" style={{ marginBottom: '2rem', overflow: 'hidden' }}>
          <SectionLabel>Request Flow</SectionLabel>
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>How a request travels through the system</h2>

          {/* Flow row */}
          <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 680 }}>

              <DiagramBox icon="🌐" label="Browser" sub="React SPA" color="#7c6ef5" />
              <Arrow label="HTTPS" />
              <DiagramBox icon="🔀" label="Nginx" sub="Port 3000" color="#f5a26e" />
              <Arrow label="proxy" />

              {/* Service cluster */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {SERVICES.map(s => (
                  <button
                    key={s.name}
                    onClick={() => setActiveService(prev => prev === s.name ? null : s.name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      background: activeService === s.name ? `${s.color}22` : 'var(--c-surface2)',
                      border: `2px solid ${activeService === s.name ? s.color : 'var(--c-border)'}`,
                      borderRadius: 'var(--radius-sm)', padding: '0.45rem 0.9rem',
                      cursor: 'pointer', transition: 'all 0.2s ease',
                      boxShadow: activeService === s.name ? `0 0 14px ${s.color}44` : 'none',
                      fontFamily: 'var(--font)', whiteSpace: 'nowrap',
                      color: activeService === s.name ? s.color : 'var(--c-text)',
                    }}
                  >
                    <span>{s.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{s.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', marginLeft: '0.25rem' }}>:{s.port}</span>
                  </button>
                ))}
              </div>

              <Arrow />

              {/* Data stores */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <DiagramBox icon="🐘" label="PostgreSQL" sub="Users & scores" color="#4edb8c" />
                <DiagramBox icon="🍃" label="MongoDB" sub="Game state" color="#4edb8c" />
                <DiagramBox icon="⚡" label="Redis" sub="Cache & ranks" color="#4edb8c" />
              </div>
            </div>
          </div>

          {/* Service detail panel */}
          {selected && (
            <div style={{
              marginTop: '1.5rem', padding: '1.25rem',
              background: `${selected.color}11`,
              border: `1px solid ${selected.color}44`,
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.4rem' }}>{selected.icon}</span>
                <div>
                  <p style={{ fontWeight: 700, color: selected.color, fontSize: '0.95rem', margin: 0 }}>{selected.name}</p>
                  <p style={{ fontSize: '0.75rem', margin: 0 }}>:{selected.port} · {selected.db}</p>
                </div>
              </div>
              <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>{selected.desc}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {selected.endpoints.map(ep => (
                  <code key={ep} style={{
                    background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
                    borderRadius: 'var(--radius-sm)', padding: '0.2rem 0.6rem',
                    fontSize: '0.75rem', color: 'var(--c-text)',
                  }}>{ep}</code>
                ))}
              </div>
            </div>
          )}

          {!selected && (
            <p style={{ marginTop: '1rem', fontSize: '0.8rem', textAlign: 'center', color: 'var(--c-text-muted)' }}>
              Click a service above to see its endpoints and responsibilities
            </p>
          )}
        </div>

        {/* ── Services Grid ── */}
        <div style={{ marginBottom: '3rem' }}>
          <SectionLabel>Services</SectionLabel>
          <h2 style={{ marginBottom: '1.25rem' }}>What each service owns</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {SERVICES.map(s => (
              <div key={s.name} className="card" style={{ borderColor: `${s.color}44` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '1.5rem' }}>{s.icon}</span>
                    <p style={{ fontWeight: 700, color: s.color, fontSize: '0.9rem', marginTop: '0.25rem', margin: 0 }}>{s.name}</p>
                  </div>
                  <code style={{ fontSize: '0.7rem', background: 'var(--c-surface2)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--c-border)', color: 'var(--c-text-muted)' }}>:{s.port}</code>
                </div>
                <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>{s.desc}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>DB — {s.db}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tech Stack ── */}
        <div style={{ marginBottom: '3rem' }}>
          <SectionLabel>Stack</SectionLabel>
          <h2 style={{ marginBottom: '1.25rem' }}>Technologies & why they were chosen</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {TECH_STACK.map(t => (
              <div key={t.name} className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.75rem', flexShrink: 0 }}>{t.icon}</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <p style={{ fontWeight: 700, color: 'var(--c-text)', margin: 0, fontSize: '0.95rem' }}>{t.name}</p>
                    <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>{t.role}</span>
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Design Decisions ── */}
        <div style={{ marginBottom: '3rem' }}>
          <SectionLabel>Engineering Decisions</SectionLabel>
          <h2 style={{ marginBottom: '1.25rem' }}>Key design choices & tradeoffs</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {DESIGN_DECISIONS.map(d => (
              <div key={d.title} className="card" style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                <span style={{
                  fontSize: '1.5rem', flexShrink: 0,
                  width: 48, height: 48,
                  background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{d.icon}</span>
                <div>
                  <p style={{ fontWeight: 700, color: 'var(--c-text)', margin: '0 0 0.4rem', fontSize: '1rem' }}>{d.title}</p>
                  <p style={{ fontSize: '0.9rem' }}>{d.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Data Flow ── */}
        <div style={{ marginBottom: '3rem' }}>
          <SectionLabel>Data Model</SectionLabel>
          <h2 style={{ marginBottom: '1.25rem' }}>What each database stores</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>

            <div className="card" style={{ borderColor: 'rgba(78,219,140,0.3)' }}>
              <p style={{ fontWeight: 700, color: '#4edb8c', marginBottom: '0.75rem' }}>🐘 PostgreSQL</p>
              <ul style={{ paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {[
                  'User — id, username, email, passwordHash, role',
                  'RefreshToken — tokenHash, userId, expiresAt, revoked',
                  'Score — userId, username, gameId, score, metadata',
                ].map(item => <li key={item} style={{ fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>{item}</li>)}
              </ul>
            </div>

            <div className="card" style={{ borderColor: 'rgba(124,110,245,0.3)' }}>
              <p style={{ fontWeight: 700, color: '#7c6ef5', marginBottom: '0.75rem' }}>🍃 MongoDB</p>
              <ul style={{ paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {[
                  'TicTacToeSession — gameId, board[], currentPlayer, status, winner, moves[]',
                  'GuessSession — gameId, secret, attempts, maxAttempts, guesses[], status',
                ].map(item => <li key={item} style={{ fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>{item}</li>)}
              </ul>
            </div>

            <div className="card" style={{ borderColor: 'rgba(245,162,110,0.3)' }}>
              <p style={{ fontWeight: 700, color: '#f5a26e', marginBottom: '0.75rem' }}>⚡ Redis</p>
              <ul style={{ paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {[
                  'refresh:{hash} → userId (TTL = token expiry)',
                  'game:ttt:{id} → serialized game state (TTL 1h)',
                  'game:guess:{id} → serialized game state (TTL 1h)',
                  'leaderboard:{gameId} → Sorted Set, score→userId:username',
                  'leaderboard:global → Sorted Set, cross-game ranking',
                ].map(item => <li key={item} style={{ fontSize: '0.85rem', color: 'var(--c-text-muted)', fontFamily: 'monospace' }}>{item}</li>)}
              </ul>
            </div>
          </div>
        </div>

        {/* ── Auth Flow ── */}
        <div style={{ marginBottom: '3rem' }}>
          <SectionLabel>Security</SectionLabel>
          <h2 style={{ marginBottom: '1.25rem' }}>Authentication & token lifecycle</h2>
          <div className="card">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
              {[
                { step: '1', label: 'Register / Login', desc: 'Credentials verified, bcrypt hash compared. Access token (15 min) + refresh token (7 days) issued.' },
                { step: '2', label: 'Access Token Use', desc: 'Each API request carries the Bearer JWT. Game services verify it locally — no auth-service round-trip.' },
                { step: '3', label: 'Silent Refresh', desc: 'On a 401, the React client transparently calls /refresh. The old token is revoked, a new pair is issued.' },
                { step: '4', label: 'Logout', desc: 'All active refresh tokens for the user are deleted from both Redis and Postgres, preventing reuse.' },
              ].map(item => (
                <div key={item.step} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <span style={{
                    width: 32, height: 32, flexShrink: 0,
                    background: 'var(--c-accent-glow)', color: 'var(--c-accent)',
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '0.85rem',
                  }}>{item.step}</span>
                  <div>
                    <p style={{ fontWeight: 700, color: 'var(--c-text)', margin: '0 0 0.25rem', fontSize: '0.9rem' }}>{item.label}</p>
                    <p style={{ fontSize: '0.85rem' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer note ── */}
        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(124,110,245,0.08), rgba(245,162,110,0.06))', borderColor: 'rgba(124,110,245,0.25)', textAlign: 'center' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--c-text)' }}>
            All services run in Docker with health checks. The Nginx gateway only starts once every
            service is healthy. Structured JSON logs are emitted at INFO / WARN / ERROR levels.
            Environment variables are validated at startup with safe defaults.
          </p>
        </div>

      </div>
    </div>
  );
}
