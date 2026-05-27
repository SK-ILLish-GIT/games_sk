# 🎮 Games Platform — Microservices Architecture (v2)

## Overview

A production-grade microservices gaming platform where each game runs as an independent Docker container. A central platform layer provides shared authentication, leaderboard, and API gateway services...

## System Diagram

```mermaid
flowchart LR
  Browser["🌐 React SPA<br/>Vite + TS"] -- HTTP --> Gateway["🔀 Nginx Gateway<br/>:3000"]

  Gateway -- "/api/auth"          --> Auth["🔐 auth-service<br/>:3001"]
  Gateway -- "/api/leaderboard"   --> LB["🏆 leaderboard-service<br/>:3002"]
  Gateway -- "/api/tic-tac-toe"   --> TTT["⭕ tic-tac-toe-service<br/>:3003"]
  Gateway -- "/api/guess-number"  --> GN["🎯 guess-number-service<br/>:3004"]
  Gateway -- "/api/hangman"       --> HM["🪢 hangman-service<br/>:3005"]
  Gateway -- "/api/flappy-bird"   --> FB["🐤 flappy-bird-service<br/>:3006"]
  Gateway -- "/"                  --> Frontend["⚛️ frontend<br/>:80"]

  Auth --> Postgres[("🐘 PostgreSQL<br/>users, refresh tokens, scores")]
  Auth --> Redis[("⚡ Redis<br/>cache, leaderboards")]
  LB   --> Postgres
  LB   --> Redis
  TTT  --> Mongo[("🍃 MongoDB<br/>game sessions, move/guess history,<br/>flappy runs + player profiles")]
  TTT  --> Redis
  GN   --> Mongo
  GN   --> Redis
  HM   --> Mongo
  HM   --> Redis
  FB   --> Mongo
  FB   --> Redis

  TTT -. "score POST" .-> LB
  GN  -. "score POST" .-> LB
  HM  -. "score POST" .-> LB
  FB  -. "score POST" .-> LB
```

### Observability sidecar (additive, opt-in via second compose file)

```mermaid
flowchart LR
  subgraph Apps [" Application services (OTel SDK) "]
    direction TB
    AppAuth["🔐 auth"]
    AppLB["🏆 leaderboard"]
    AppTTT["⭕ tic-tac-toe"]
    AppGN["🎯 guess-number"]
    AppHM["🪢 hangman"]
    AppFB["🐤 flappy-bird"]
  end

  Apps -- "OTLP/gRPC :4317" --> Coll["📡 OTel Collector"]
  Docker[("🐳 Docker daemon")] -- "docker_stats" --> Coll
  Promtail["📜 Promtail"] -- "container stdout" --> Loki

  Coll -- traces  --> Tempo["🧵 Tempo"]
  Coll -- metrics --> Prom["📈 Prometheus"]
  Coll -- logs    --> Loki["📦 Loki"]
  Tempo -- "span-metrics<br/>remote_write" --> Prom

  Tempo --> Grafana["🖥️ Grafana — 6 dashboards<br/>trace ↔ logs links"]
  Prom  --> Grafana
  Loki  --> Grafana
```

## Services

| Service              | Port | Tech                     | Responsibility                         |
|----------------------|------|--------------------------|----------------------------------------|
| **gateway**          | 3000 | Nginx 1.25               | Reverse proxy, TLS termination, routing |
| **frontend**         | 80   | React 18 + Vite + Nginx  | SPA served as static files             |
| **auth-service**     | 3001 | Node/Express + Prisma    | Register, Login, JWT, Refresh tokens   |
| **leaderboard-service** | 3002 | Node/Express + Redis | Score submission, ranked leaderboards |
| **tic-tac-toe-service** | 3003 | Node/Express + Mongoose | Game logic, state via Redis+MongoDB |
| **guess-number-service** | 3004 | Node/Express + Mongoose | Guess game, scoring, state caching |
| **hangman-service**  | 3005 | Node/Express + Mongoose  | Hangman, difficulty tiers, masked-word view |
| **flappy-bird-service** | 3006 | Node/Express + Mongoose  | Six modes, cosmetic unlocks, HMAC-signed run validation |
| **postgres**         | 5432 | PostgreSQL 16            | Auth users, refresh tokens, scores     |
| **mongo**            | 27017 | MongoDB 7               | Game sessions, move history            |
| **redis**            | 6379 | Redis 7                  | Cache, sessions, leaderboard, pub/sub  |

## Data Flow

### Authentication

```mermaid
sequenceDiagram
  autonumber
  participant Client
  participant Gateway as Nginx Gateway
  participant Auth as auth-service
  participant PG as PostgreSQL
  participant Redis

  Client->>Gateway: POST /api/auth/register
  Gateway->>Auth: POST /register
  Auth->>PG: bcrypt hash + INSERT user, refreshToken
  Auth->>Redis: SET refresh:{hash} → userId
  Auth-->>Client: { accessToken (15m), refreshToken (7d) }

  Note over Client,Gateway: subsequent calls<br/>Authorization: Bearer ...
  Client->>Gateway: GET /api/hangman/games (Bearer)
  Note right of Gateway: each service verifies JWT locally —<br/>no auth-service network hop
```

### Score submission (on game finish)

```mermaid
sequenceDiagram
  autonumber
  participant Game as Game service
  participant LB as leaderboard-service
  participant PG as PostgreSQL
  participant Redis

  Game->>LB: POST /scores { userId, gameId, score, … }
  LB->>PG: INSERT INTO scores
  LB->>Redis: ZADD leaderboard:{gameId} score user
  LB->>Redis: ZADD leaderboard:global  score user
  LB-->>Game: 201 Created (fire-and-forget on the game side)
```

### Leaderboard read (Redis hot path)

```mermaid
sequenceDiagram
  autonumber
  participant Client
  participant Gateway as Nginx Gateway
  participant LB as leaderboard-service
  participant Redis

  Client->>Gateway: GET /api/leaderboard/tic-tac-toe
  Gateway->>LB: GET /leaderboard/tic-tac-toe
  LB->>Redis: ZREVRANGE leaderboard:tic-tac-toe 0 N
  Redis-->>LB: top-N scores
  LB-->>Client: 200 OK (no DB hit, < 1 ms)
```

### Game state (Redis cache-aside, MongoDB backing store)

```mermaid
sequenceDiagram
  autonumber
  participant Client
  participant TTT as tic-tac-toe-service
  participant Redis
  participant Mongo as MongoDB

  Client->>TTT: POST /games/{id}/move
  TTT->>Redis: GET game:ttt:{id}
  alt cache hit
    Redis-->>TTT: serialized state
  else cache miss
    TTT->>Mongo: findOne({ gameId })
    Mongo-->>TTT: state document
  end
  TTT->>TTT: apply move (pure engine)
  TTT->>Redis: SETEX game:ttt:{id} 3600 …
  TTT->>Mongo: upsert document (durable backup)
  TTT-->>Client: 200 OK { state }
```

### Flappy Bird run lifecycle (server-authoritative + HMAC-signed)

```mermaid
sequenceDiagram
  autonumber
  participant Client
  participant FB as flappy-bird-service
  participant Redis
  participant Mongo as MongoDB
  participant LB as leaderboard-service

  Client->>FB: POST /games { mode, cosmetics }
  FB->>FB: pick canonical physics for mode<br/>derive seed (random or daily)
  FB->>FB: HMAC(gameId | seed | mode | playerId | startedAt)
  FB->>Mongo: insert FlappySession (status=active)
  FB->>Redis: SETEX game:flappy:{id} 3600 …
  FB-->>Client: { gameId, seed, physics, signature, durationCapSec }

  Note over Client: Client runs the sim at 60 fps using<br/>those exact physics + seed (deterministic)

  Client->>FB: POST /games/{id}/finish { score, distance, jumps, durationMs, signature }
  FB->>FB: timing-safe verify signature
  FB->>FB: validateRun() — score/jump/distance rate ceilings
  alt verdict.ok
    FB->>Mongo: update session (finished, finalScore = raw × multiplier)
    FB->>Mongo: upsert FlappyProfile — high score, unlocks
    FB-)LB: POST /scores (fire-and-forget)
    FB-->>Client: { score, newHighScore, unlocks[] }
  else rejected
    FB->>Mongo: status=rejected, rejectReason=...
    FB-->>Client: 422 { rawScore, error }
  end
```

The client is trusted only for the **inputs** of a run; the server owns
the physics constants, the HMAC, and a per-mode score-rate ceiling
(`engine.maxScorePerSec * scoreSlack + 5`). Runs that exceed the ceiling
or whose distance is inconsistent with elapsed time × pipe speed are
recorded as `rejected` and never reach the leaderboard.

## Redis Key Convention

| Key Pattern                    | Type         | TTL  | Purpose                     |
|-------------------------------|--------------|------|-----------------------------|
| `refresh:{tokenHash}`         | String       | 7d   | Fast token lookup           |
| `leaderboard:{gameId}`        | Sorted Set   | —    | Per-game top scores         |
| `leaderboard:global`          | Sorted Set   | —    | All-games combined          |
| `game:ttt:{gameId}`           | JSON String  | 1h   | Tic-tac-toe state cache     |
| `game:guess:{gameId}`         | JSON String  | 1h   | Guess-number state cache    |
| `game:hangman:{gameId}`       | JSON String  | 1h   | Hangman state cache         |
| `game:flappy:{gameId}`        | JSON String  | 1h   | Flappy run state (mode, seed, signed) |
| `flappy:daily-seed:{YYYY-MM-DD}` | String    | 24h  | Shared seed for *Daily Seed* mode (same level for everyone that day) |

## Observability (MELT)

Every service is instrumented with OpenTelemetry via the shared
`@games-platform/observability` package, loaded zero-code via
`node --require @games-platform/observability/tracing` in each Dockerfile's
`CMD`. That gives you:

- **Traces** — auto-instrumented Express, HTTP, ioredis, mongoose, pg, axios
- **Metrics** — typed domain instruments in `gamesMetrics` (registrations,
  logins, games_started/finished/score/duration with a `mode` label for
  Flappy, hangman guess split, flappy jumps + pipes-passed counters,
  leaderboard submissions/lookups, active sessions gauge) plus auto HTTP
  metrics
- **Logs** — `createLogger(serviceName)` emits JSON with `trace_id` /
  `span_id` injected from the active span

The collector also runs the `docker_stats` receiver so per-container CPU /
memory / network arrive even on Docker Desktop where cAdvisor's filesystem
path is empty. Tempo's metrics-generator emits `traces_spanmetrics_*`
(RED) back to Prometheus via remote-write — the Overview dashboard's RED
panels read those.

Six dashboards are provisioned automatically: Overview, Auth, Games
(combined), Hangman, Guess Number, Tic-Tac-Toe — all cross-linked.

See **OBSERVABILITY.md** for: full custom-metric reference, dashboard
catalogue, how trace ↔ logs correlation is wired, troubleshooting, and
the production-hardening checklist.

## Adding a New Game

1. `cp -r services/tic-tac-toe-service services/my-game-service`
2. Implement game logic in `src/game/engine.ts` (pure functions)
3. Add `my-game-service` block in `docker-compose.yml` (copy 10 lines,
   keep `build.context: .` and `dockerfile: services/my-game-service/Dockerfile`)
4. Add Nginx `location /api/my-game/` block in `gateway/conf.d/routes.conf`
5. Add React page in `frontend/src/pages/` and route in `main.tsx`
6. Add game card to `GAMES` array in `frontend/src/pages/HomePage.tsx`
7. (Optional) Record domain metrics:

   ```ts
   import { gamesMetrics } from '@games-platform/observability';
   gamesMetrics.gameStartedTotal.add(1, { game: 'my-game' });
   gamesMetrics.gameFinishedTotal.add(1, { game: 'my-game', outcome: 'won' });
   ```

   The combined Games dashboard uses `sum by (game)`, so a new `game` label
   value appears as a new line — no dashboard change required.

**Zero changes** to auth-service, leaderboard-service, gateway logic, or
existing dashboards.

## Tech Stack

| Layer              | Technology                              |
|--------------------|-----------------------------------------|
| Frontend           | React 18, Vite 5, TypeScript, React Router |
| Gateway            | Nginx 1.25                             |
| Backend Services   | Node.js 20 LTS, Express 4, TypeScript  |
| Auth / ORM         | Prisma 5 + PostgreSQL 16               |
| Game Storage       | MongoDB 7 + Mongoose                   |
| Cache / Broker     | Redis 7 (ioredis)                      |
| Containerisation   | Docker + Docker Compose v2             |
| Shared Types       | `packages/shared-types/`               |
| Observability      | OpenTelemetry SDK + Collector contrib, Prometheus, Loki, Tempo, Grafana |
| Shared Telemetry   | `packages/observability/` — `gamesMetrics`, `createLogger`, OTel bootstrap |

## Running the Platform

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Build and start the application stack
docker compose up --build

# 3. Open http://localhost:3000
```

First boot runs Prisma migrations automatically inside auth-service.

### With observability (optional)

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.observability.yml \
  up -d
```

Open Grafana at **http://localhost:3030** (admin / admin). Dashboards live in
the *Games Platform* folder.
