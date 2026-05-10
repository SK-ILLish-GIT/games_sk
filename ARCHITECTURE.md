# 🎮 Games Platform — Microservices Architecture (v2)

## Overview

A production-grade microservices gaming platform where each game runs as an independent Docker container. A central platform layer provides shared authentication, leaderboard, and API gateway services...

## System Diagram

```
                    ┌────────────────────────────────────────────┐
                    │         React SPA (Vite + TypeScript)       │
                    │   Home | Login | TicTacToe | GuessNumber    │
                    │   Leaderboard | Auth Context                 │
                    └─────────────────────┬──────────────────────┘
                                          │ HTTPS
                    ┌─────────────────────▼──────────────────────┐
                    │            Nginx API Gateway                 │
                    │   Rate Limiting · JWT pass-through           │
                    │   /api/auth → auth-service:3001              │
                    │   /api/leaderboard → leaderboard:3002        │
                    │   /api/tic-tac-toe → ttt-service:3003        │
                    │   /api/guess-number → guess-service:3004     │
                    │   / → frontend:80 (React SPA)               │
                    └──┬──────────┬───────────────┬───────────────┘
                       │          │               │
         ┌─────────────▼──┐ ┌────▼──────────┐ ┌─▼──────────────────┐
         │  Auth Service   │ │  Leaderboard  │ │   Game Services     │
         │  Node/Express   │ │  Node/Express │ │ TicTacToe (3003)   │
         │  TypeScript     │ │  TypeScript   │ │ GuessNumber (3004)  │
         │  PostgreSQL+JWT │ │  Redis+PG     │ │ MongoDB + Redis     │
         └────────┬────────┘ └───────┬───────┘ └────────────────────┘
                  │                  │                │
         ┌────────▼──────────────────▼────────────────▼────────────┐
         │                   Data Layer (Docker volumes)            │
         │  PostgreSQL 16  — Users, Refresh Tokens, Scores         │
         │  MongoDB 7      — Game Sessions, Move History            │
         │  Redis 7        — Sessions, Leaderboard Sorted Sets,    │
         │                   Game State Cache, Pub/Sub              │
         └──────────────────────────────────────────────────────────┘
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
| **postgres**         | 5432 | PostgreSQL 16            | Auth users, refresh tokens, scores     |
| **mongo**            | 27017 | MongoDB 7               | Game sessions, move history            |
| **redis**            | 6379 | Redis 7                  | Cache, sessions, leaderboard, pub/sub  |

## Data Flow

### Authentication
```
Client → POST /api/auth/register → auth-service → PostgreSQL
         ← { accessToken (15m JWT), refreshToken (7d) }
Client → GET /api/* (Authorization: Bearer <token>)
         ← Each service validates JWT inline (no auth-service network hop)
```

### Score Submission (on game finish)
```
Game Service → POST http://leaderboard-service/scores
             → PostgreSQL: INSERT INTO scores
             → Redis: ZADD leaderboard:{gameId} {score} {userId}:{username}
             → Redis: ZADD leaderboard:global {score} {userId}:{username}
```

### Leaderboard Read (Redis hot path)
```
Client → GET /api/leaderboard/leaderboard/tic-tac-toe
       → leaderboard-service → Redis ZREVRANGE (O(log N + M))
       ← top-N scores in < 1ms (no DB hit)
```

### Game State (Redis cache-aside)
```
Client → POST /api/tic-tac-toe/games/:id/move
       → tic-tac-toe-service → Redis GET game:ttt:{id}  (cache hit)
       → apply move → Redis SETEX game:ttt:{id} 3600
       → MongoDB upsert (persistent backup)
       ← updated game state
```

## Redis Key Convention

| Key Pattern                    | Type         | TTL  | Purpose                     |
|-------------------------------|--------------|------|-----------------------------|
| `refresh:{tokenHash}`         | String       | 7d   | Fast token lookup           |
| `leaderboard:{gameId}`        | Sorted Set   | —    | Per-game top scores         |
| `leaderboard:global`          | Sorted Set   | —    | All-games combined          |
| `game:ttt:{gameId}`           | JSON String  | 1h   | Tic-tac-toe state cache     |
| `game:guess:{gameId}`         | JSON String  | 1h   | Guess-number state cache    |

## Adding a New Game

1. `cp -r services/_template-service services/my-game-service` (or scaffold manually)
2. Implement game logic in `src/game/engine.ts` (pure functions)
3. Add `my-game-service` block in `docker-compose.yml` (copy 10 lines)
4. Add Nginx `location /api/my-game/` block in `gateway/conf.d/routes.conf` (4 lines)
5. Add React page in `frontend/src/pages/` and route in `main.tsx`
6. Add game card to `GAMES` array in `frontend/src/pages/HomePage.tsx`

**Zero changes** to auth-service, leaderboard-service, or gateway logic.

## Tech Stack

| Layer              | Technology                              |
|--------------------|-----------------------------------------|
| Frontend           | React 18, Vite 5, TypeScript, React Router |
| Gateway            | Nginx 1.25                             |
| Backend Services   | Node.js 20 LTS, Express 5, TypeScript  |
| Auth / ORM         | Prisma 5 + PostgreSQL 16               |
| Game Storage       | MongoDB 7 + Mongoose                   |
| Cache / Broker     | Redis 7 (ioredis)                      |
| Containerisation   | Docker + Docker Compose v2             |
| Shared Types       | `packages/shared-types/`               |

## Running the Platform

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Build and start all containers
docker compose up --build

# 3. Open http://localhost:3000
```

First boot runs Prisma migrations automatically inside auth-service.
