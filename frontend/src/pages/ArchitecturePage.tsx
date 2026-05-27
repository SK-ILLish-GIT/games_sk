import React, { useState } from 'react';
import BlurText from '../components/ui/BlurText';
import SpotlightCard from '../components/ui/SpotlightCard';
import MermaidDiagram from '../components/ui/MermaidDiagram';

/* ─────────────────────────────────────────────────────
   Mermaid diagram sources
───────────────────────────────────────────────────── */

const SYSTEM_TOPOLOGY_DIAGRAM = `flowchart LR
  Browser["🌐 React SPA<br/>Vite + TS"] -- HTTP --> Gateway

  subgraph Gateway_Layer [" "]
    Gateway["🔀 Nginx Gateway<br/>:3000"]
  end

  Gateway -- "/api/auth"          --> Auth["🔐 auth-service<br/>:3001"]
  Gateway -- "/api/leaderboard"   --> LB["🏆 leaderboard-service<br/>:3002"]
  Gateway -- "/api/tic-tac-toe"   --> TTT["⭕ tic-tac-toe-service<br/>:3003"]
  Gateway -- "/api/guess-number"  --> GN["🎯 guess-number-service<br/>:3004"]
  Gateway -- "/api/hangman"       --> HM["🪢 hangman-service<br/>:3005"]
  Gateway -- "/api/flappy-bird"   --> FB["🐤 flappy-bird-service<br/>:3006"]
  Gateway -- "/"                  --> Frontend["⚛️ frontend<br/>:80"]

  Auth --> Postgres[("🐘 PostgreSQL")]
  Auth --> Redis[("⚡ Redis")]
  LB   --> Postgres
  LB   --> Redis
  TTT  --> Mongo[("🍃 MongoDB")]
  TTT  --> Redis
  GN   --> Mongo
  GN   --> Redis
  HM   --> Mongo
  HM   --> Redis
  FB   --> Mongo
  FB   --> Redis

  TTT  -.score POST.-> LB
  GN   -.score POST.-> LB
  HM   -.score POST.-> LB
  FB   -.score POST.-> LB

  classDef edge fill:#0e0e14,stroke:#7c6ef5,color:#e6e6f0;
  classDef svc  fill:#1c1c24,stroke:#7c6ef5,color:#e6e6f0;
  classDef data fill:#26262f,stroke:#4edb8c,color:#e6e6f0;
  class Browser,Frontend,Gateway edge;
  class Auth,LB,TTT,GN,HM,FB svc;
  class Postgres,Mongo,Redis data;
  style Gateway_Layer fill:transparent,stroke:transparent;
`;

const OBSERVABILITY_PIPELINE_DIAGRAM = `flowchart LR
  subgraph Apps [" Application services "]
    direction TB
    AppAuth["🔐 auth-service"]
    AppLB["🏆 leaderboard-service"]
    AppTTT["⭕ tic-tac-toe-service"]
    AppGN["🎯 guess-number-service"]
    AppHM["🪢 hangman-service"]
    AppFB["🐤 flappy-bird-service"]
  end

  Promtail["📜 Promtail<br/>(tails Docker stdout)"]
  Docker[("🐳 Docker Daemon")]

  Apps -- "OTLP/gRPC :4317" --> Coll["📡 OTel Collector<br/>otel/opentelemetry-collector-contrib"]
  Docker -- "docker_stats receiver" --> Coll
  Promtail -- "loki push" --> Loki

  Coll -- traces  --> Tempo["🧵 Tempo"]
  Coll -- metrics --> Prom["📈 Prometheus"]
  Coll -- logs    --> Loki["📦 Loki"]

  Tempo -- "span-metrics<br/>remote_write" --> Prom

  Tempo  --> Grafana["🖥️ Grafana<br/>6 dashboards"]
  Prom   --> Grafana
  Loki   --> Grafana

  classDef app fill:#1c1c24,stroke:#7c6ef5,color:#e6e6f0;
  classDef ingest fill:#26262f,stroke:#f5a26e,color:#e6e6f0;
  classDef store fill:#26262f,stroke:#4edb8c,color:#e6e6f0;
  classDef ui fill:#1c1c24,stroke:#f5617c,color:#e6e6f0;
  class AppAuth,AppLB,AppTTT,AppGN,AppHM,AppFB app;
  class Coll,Promtail,Docker ingest;
  class Tempo,Prom,Loki store;
  class Grafana ui;
`;

const AUTH_FLOW_DIAGRAM = `sequenceDiagram
  autonumber
  participant Client
  participant Gateway as Nginx Gateway
  participant Auth as auth-service
  participant DB as PostgreSQL
  participant Redis

  Client->>Gateway: POST /api/auth/login
  Gateway->>Auth: POST /login
  Auth->>DB: SELECT user, bcrypt.compare
  Auth->>DB: INSERT refreshToken (sha256 hash)
  Auth->>Redis: SET refresh:{hash} → userId
  Auth-->>Client: { accessToken (15m), refreshToken (7d) }

  Note over Client,Gateway: subsequent calls<br/>Authorization: Bearer ...
  Client->>Gateway: GET /api/hangman/games (Bearer)
  Gateway->>Auth: -- not contacted --
  Note right of Gateway: each service verifies<br/>JWT locally, no DB hop
`;

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
  {
    icon: '🔭',
    name: 'OpenTelemetry',
    role: 'Instrumentation',
    desc: 'Every Node service runs the OTel SDK via node --require, with auto-instrumentations for Express, HTTP, ioredis, mongoose, pg, and axios. Domain metrics + structured JSON logs come from a shared @games-platform/observability package.',
  },
  {
    icon: '📊',
    name: 'Grafana Stack',
    role: 'Observability Backend',
    desc: 'OpenTelemetry Collector fans out OTLP to Prometheus (metrics), Loki (logs), and Tempo (traces). Six provisioned Grafana dashboards cover service RED metrics, container CPU/memory, auth funnel, and per-game gameplay analytics.',
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
  {
    name: 'hangman-service',
    port: '3005',
    db: 'MongoDB + Redis',
    color: '#6ec1f5',
    icon: '🪢',
    desc: 'Hangman with easy / medium / hard difficulty tiers. Returns a masked-word view; reveals the word only after the game finishes.',
    endpoints: ['POST /games', 'GET /games/:id', 'POST /games/:id/guess'],
  },
  {
    name: 'flappy-bird-service',
    port: '3006',
    db: 'MongoDB + Redis',
    color: '#ffd166',
    icon: '🐤',
    desc: 'Six modes (Endless, Time Attack, Gravity Flip, Reverse, Chaos, Daily Seed), unlockable cosmetic loadouts, and HMAC-signed runs validated server-side against per-mode score-rate ceilings before reaching the leaderboard.',
    endpoints: ['GET /config', 'POST /games', 'GET /games/:id', 'POST /games/:id/finish', 'GET /profile/me', 'PUT /profile/cosmetics'],
  },
];

const OBSERVABILITY_STACK = [
  {
    icon: '📡',
    name: 'OpenTelemetry Collector',
    role: 'OTLP Ingress',
    desc: 'Single ingress for app traces / metrics / logs over OTLP. Also runs the docker_stats receiver so per-container CPU / memory works on Docker Desktop.',
  },
  {
    icon: '📈',
    name: 'Prometheus',
    role: 'Metrics Store',
    desc: 'Scrapes the collector, node-exporter, and cAdvisor; stores time series. Tempo also remote-writes RED metrics generated from spans (request rate, error rate, latency histograms).',
  },
  {
    icon: '📜',
    name: 'Loki + Promtail',
    role: 'Log Aggregation',
    desc: 'Loki stores structured JSON logs. Promtail ships every container\'s stdout to Loki and parses level / trace_id / span_id so log → trace navigation works.',
  },
  {
    icon: '🧵',
    name: 'Tempo',
    role: 'Trace Backend',
    desc: 'Stores distributed traces and runs a metrics generator that emits service-graph and span-metrics back to Prometheus.',
  },
  {
    icon: '🖥️',
    name: 'Grafana',
    role: 'Single Pane of Glass',
    desc: 'Six provisioned dashboards (Overview, Auth, combined Games, Hangman, Guess Number, Tic-Tac-Toe) with bidirectional Loki ↔ Tempo links — click a trace_id in a log to open its trace in a side panel.',
  },
];

type MetricType = 'counter' | 'histogram' | 'gauge';

const CUSTOM_METRICS: {
  name: string;
  type: MetricType;
  unit?: string;
  labels: string;
  source: string;
}[] = [
  { name: 'auth_registrations_total',           type: 'counter',   labels: 'result',                             source: 'auth' },
  { name: 'auth_logins_total',                  type: 'counter',   labels: 'result',                             source: 'auth' },
  { name: 'auth_active_sessions',               type: 'gauge',     labels: '—',                                  source: 'auth' },
  { name: 'games_started_total',                type: 'counter',   labels: 'game, difficulty, mode',             source: 'all games' },
  { name: 'games_finished_total',               type: 'counter',   labels: 'game, outcome, difficulty, mode',    source: 'all games' },
  { name: 'games_score_*',                      type: 'histogram', labels: 'game, outcome, difficulty, mode',    source: 'all games' },
  { name: 'games_duration_seconds_*',           type: 'histogram', unit: 's', labels: 'game, outcome, mode',     source: 'all games' },
  { name: 'hangman_guesses_total',              type: 'counter',   labels: 'kind, correct, difficulty',          source: 'hangman' },
  { name: 'flappy_jumps_total',                 type: 'counter',   labels: 'kind, mode',                         source: 'flappy-bird' },
  { name: 'flappy_pipes_passed_total',          type: 'counter',   labels: 'mode',                               source: 'flappy-bird' },
  { name: 'leaderboard_score_submitted_total',  type: 'counter',   labels: 'game',                               source: 'leaderboard' },
  { name: 'leaderboard_lookups_total',          type: 'counter',   labels: 'scope, game',                        source: 'leaderboard' },
];

const METRIC_TYPE_COLOR: Record<MetricType, string> = {
  counter:   '#7c6ef5',
  histogram: '#f5a26e',
  gauge:     '#4edb8c',
};

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
  {
    title: 'Zero-Code OTel Bootstrap',
    icon: '🔭',
    body: `Each Dockerfile launches the service with node --require @games-platform/observability/tracing. The shared package starts the OTel SDK before any instrumented library loads — no code change in app entry points. Auto-instrumentation covers Express, HTTP, ioredis, mongoose, pg, and axios.`,
  },
  {
    title: 'Standardised Logger with Trace Correlation',
    icon: '📝',
    body: `Every Node service uses createLogger(serviceName) from the shared observability package. Every log line is JSON, includes service / level / timestamp, and carries trace_id and span_id when emitted inside an active span. Loki's derived fields turn the trace_id into a clickable link to Tempo.`,
  },
  {
    title: 'Lazy-Resolved Custom Metrics',
    icon: '⏱️',
    body: `gamesMetrics is a Proxy that resolves each instrument against the current global meter on every access. This avoids a real-world OTel gotcha where instruments imported before initTelemetry() bind to the no-op default provider and silently drop every record.`,
  },
  {
    title: 'Server-Authoritative Flappy Runs',
    icon: '🐤',
    body: `Flappy Bird picks its physics, seed, and a per-mode score-rate ceiling on the server, signs the run start with an HMAC, and validates the submitted score / distance / jumps / duration on /finish. The client runs the sim at 60 fps for snappy feedback, but the leaderboard only sees scores that survive the server-side validator — runs that exceed the ceiling or whose distance is inconsistent with elapsed time × pipe speed are persisted as "rejected" for analytics and dropped.`,
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

function MetricsTable() {
  return (
    <div style={{
      overflowX: 'auto',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--c-border)',
      background: 'var(--c-surface2)',
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '0.82rem',
        minWidth: 720,
      }}>
        <thead>
          <tr style={{
            background: 'rgba(124, 110, 245, 0.08)',
            borderBottom: '1px solid var(--c-border)',
          }}>
            {[
              { label: 'Metric',   width: '38%', align: 'left'  as const },
              { label: 'Type',     width: '14%', align: 'left'  as const },
              { label: 'Unit',     width: '8%',  align: 'left'  as const },
              { label: 'Labels',   width: '26%', align: 'left'  as const },
              { label: 'Source',   width: '14%', align: 'left'  as const },
            ].map(col => (
              <th key={col.label} style={{
                padding: '0.55rem 0.85rem',
                textAlign: col.align,
                width: col.width,
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--c-text-muted)',
                fontWeight: 700,
              }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CUSTOM_METRICS.map((m, idx) => (
            <tr key={m.name} style={{
              borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
              background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
            }}>
              <td style={{
                padding: '0.5rem 0.85rem',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '0.78rem',
                color: 'var(--c-text)',
              }}>{m.name}</td>
              <td style={{ padding: '0.5rem 0.85rem' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.1rem 0.55rem',
                  borderRadius: '999px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: `${METRIC_TYPE_COLOR[m.type]}1f`,
                  color: METRIC_TYPE_COLOR[m.type],
                  border: `1px solid ${METRIC_TYPE_COLOR[m.type]}55`,
                  letterSpacing: '0.04em',
                }}>{m.type}</span>
              </td>
              <td style={{
                padding: '0.5rem 0.85rem',
                color: 'var(--c-text-muted)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '0.78rem',
              }}>{m.unit ?? '—'}</td>
              <td style={{
                padding: '0.5rem 0.85rem',
                color: 'var(--c-text-muted)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '0.78rem',
              }}>{m.labels}</td>
              <td style={{
                padding: '0.5rem 0.85rem',
                color: 'var(--c-text-muted)',
                fontSize: '0.78rem',
              }}>{m.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
          <h1 className="page-title">
            <BlurText text="Platform Architecture" delay={100} />
          </h1>
          <p style={{ maxWidth: 640, marginTop: '0.5rem' }}>
            A production-style microservices platform where each game is a fully
            independent service — isolated deployment, separate database, its own cache.
            Shared Auth and Leaderboard services provide identity and cross-game ranking.
          </p>
        </div>

        {/* ── Architecture Diagram ── */}
        <SpotlightCard className="card" style={{ marginBottom: '2rem', overflow: 'hidden' }} spotlightColor="rgba(124, 110, 245, 0.15)">
          <SectionLabel>Request Flow</SectionLabel>
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>How a request travels through the system</h2>

          {/* Mermaid topology */}
          <MermaidDiagram chart={SYSTEM_TOPOLOGY_DIAGRAM} minWidth={780} />

          {/* Interactive picker */}
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--c-border)', paddingTop: '1.25rem' }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--c-text-muted)', marginBottom: '0.6rem', letterSpacing: '0.04em' }}>
              Click a service to see its endpoints
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
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

        </SpotlightCard>

        {/* ── Services Grid ── */}
        <div style={{ marginBottom: '3rem' }}>
          <SectionLabel>Services</SectionLabel>
          <h2 style={{ marginBottom: '1.25rem' }}>What each service owns</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {SERVICES.map(s => (
              <SpotlightCard key={s.name} className="card" style={{ borderColor: `${s.color}44` }} spotlightColor={`${s.color}22`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '1.5rem' }}>{s.icon}</span>
                    <p style={{ fontWeight: 700, color: s.color, fontSize: '0.9rem', marginTop: '0.25rem', margin: 0 }}>{s.name}</p>
                  </div>
                  <code style={{ fontSize: '0.7rem', background: 'var(--c-surface2)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--c-border)', color: 'var(--c-text-muted)' }}>:{s.port}</code>
                </div>
                <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>{s.desc}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>DB — {s.db}</p>
              </SpotlightCard>
            ))}
          </div>
        </div>

        {/* ── Tech Stack ── */}
        <div style={{ marginBottom: '3rem' }}>
          <SectionLabel>Stack</SectionLabel>
          <h2 style={{ marginBottom: '1.25rem' }}>Technologies & why they were chosen</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {TECH_STACK.map(t => (
              <SpotlightCard key={t.name} className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }} spotlightColor="rgba(255, 255, 255, 0.05)">
                <span style={{ fontSize: '1.75rem', flexShrink: 0 }}>{t.icon}</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <p style={{ fontWeight: 700, color: 'var(--c-text)', margin: 0, fontSize: '0.95rem' }}>{t.name}</p>
                    <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>{t.role}</span>
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{t.desc}</p>
                </div>
              </SpotlightCard>
            ))}
          </div>
        </div>

        {/* ── Observability ── */}
        <div style={{ marginBottom: '3rem' }}>
          <SectionLabel>Observability</SectionLabel>
          <h2 style={{ marginBottom: '1.25rem' }}>How we see what the platform is doing</h2>

          <SpotlightCard className="card" style={{ marginBottom: '1rem', overflow: 'hidden' }} spotlightColor="rgba(78, 219, 140, 0.12)">
            <p style={{ fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Every Node service is OpenTelemetry-instrumented via the shared
              <code style={{ background: 'var(--c-surface2)', padding: '0.1rem 0.4rem', margin: '0 0.25rem', borderRadius: '4px', fontSize: '0.8rem' }}>@games-platform/observability</code>
              package. Telemetry flows through a single OpenTelemetry Collector
              that fans out to Prometheus, Loki, and Tempo — all visualised in Grafana.
            </p>

            <MermaidDiagram chart={OBSERVABILITY_PIPELINE_DIAGRAM} minWidth={820} />

            <p style={{ fontSize: '0.78rem', color: 'var(--c-text-muted)', textAlign: 'center', marginTop: '1rem' }}>
              Promtail tails every container's stdout into Loki; the
              collector's <code style={{ background: 'var(--c-surface2)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.78rem' }}>docker_stats</code>
              receiver emits per-container CPU / memory; Tempo's metrics generator
              remote-writes RED metrics back to Prometheus.
            </p>
          </SpotlightCard>

          {/* Stack components */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {OBSERVABILITY_STACK.map(t => (
              <SpotlightCard key={t.name} className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }} spotlightColor="rgba(78, 219, 140, 0.08)">
                <span style={{ fontSize: '1.75rem', flexShrink: 0 }}>{t.icon}</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <p style={{ fontWeight: 700, color: 'var(--c-text)', margin: 0, fontSize: '0.95rem' }}>{t.name}</p>
                    <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>{t.role}</span>
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{t.desc}</p>
                </div>
              </SpotlightCard>
            ))}
          </div>

          {/* Custom metrics table */}
          <SpotlightCard className="card" spotlightColor="rgba(124, 110, 245, 0.1)">
            <p style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.95rem', color: 'var(--c-text)' }}>Custom domain metrics</p>
            <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              Defined once in <code style={{ background: 'var(--c-surface2)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.78rem' }}>packages/observability/src/index.ts</code>,
              recorded across services. Names below are the Prometheus form
              (dots&nbsp;→ underscores, plus type / unit suffixes).
            </p>
            <MetricsTable />
          </SpotlightCard>

          {/* Dashboards */}
          <SpotlightCard className="card" style={{ marginTop: '1rem' }} spotlightColor="rgba(245, 162, 110, 0.1)">
            <p style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.95rem', color: 'var(--c-text)' }}>Provisioned Grafana dashboards</p>
            <ul style={{ paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: 0 }}>
              {[
                ['Overview', 'RED metrics by service, container CPU / memory, recent errors across the platform'],
                ['Auth Service', 'active sessions gauge, registrations / logins by result, login-failure rate, per-route p95'],
                ['Games (combined)', 'started/finished by game, win-rate by game and Hangman difficulty, score histogram, leaderboard activity'],
                ['Hangman', 'guesses/sec by kind & correctness, accuracy by difficulty, score & duration distributions'],
                ['Guess Number', 'outcome rate, score histogram, duration p50/p95'],
                ['Tic-Tac-Toe', 'won vs draw rate, outcome timeseries, score & duration distributions'],
              ].map(([title, desc]) => (
                <li key={title} style={{ fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>{title}</span> — {desc}
                </li>
              ))}
            </ul>
          </SpotlightCard>
        </div>

        {/* ── Design Decisions ── */}
        <div style={{ marginBottom: '3rem' }}>
          <SectionLabel>Engineering Decisions</SectionLabel>
          <h2 style={{ marginBottom: '1.25rem' }}>Key design choices & tradeoffs</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {DESIGN_DECISIONS.map(d => (
              <SpotlightCard key={d.title} className="card" style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }} spotlightColor="rgba(124, 110, 245, 0.1)">
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
              </SpotlightCard>
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
                  'HangmanSession — gameId, word, difficulty, guessedLetters[], wrongGuesses, guesses[], status',
                  'FlappySession — gameId, mode, seed, physics, cosmetics, signature, status (active|finished|rejected), score, rawScore, distance, jumps, durationMs, rejectReason',
                  'FlappyProfile — playerId, unlockedSkins/pipes/backgrounds/trails/audio[], selected loadout, highScores per mode',
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
                  'game:hangman:{id} → serialized game state (TTL 1h)',
                  'game:flappy:{id} → flappy run state, signed (TTL 1h)',
                  'flappy:daily-seed:{YYYY-MM-DD} → shared seed for Daily Seed mode (TTL 24h)',
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

          <SpotlightCard className="card" style={{ marginBottom: '1rem' }} spotlightColor="rgba(124, 110, 245, 0.1)">
            <MermaidDiagram chart={AUTH_FLOW_DIAGRAM} minWidth={680} />
          </SpotlightCard>

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
            All services run in Docker with health checks. The Nginx gateway only starts
            once every service is healthy. Structured JSON logs include <code style={{ background: 'var(--c-surface2)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>trace_id</code> /
            <code style={{ background: 'var(--c-surface2)', padding: '0.1rem 0.4rem', margin: '0 0.2rem', borderRadius: '4px', fontSize: '0.8rem' }}>span_id</code>
            for log ↔ trace navigation in Grafana. Environment variables are validated at
            startup with safe defaults. The observability overlay is opt-in via a second
            compose file — apps run identically with or without it.
          </p>
        </div>

      </div>
    </div>
  );
}
