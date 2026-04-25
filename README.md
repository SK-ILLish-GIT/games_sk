# 🎮 GameVault — Microservices Gaming Platform

A production-grade gaming platform built with a microservices architecture. Each game runs as an independent Docker service. A central platform layer handles authentication, leaderboard, and API routing.

[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-green?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Docker](https://img.shields.io/badge/Docker-Compose_v2-2496ED?logo=docker)](https://docs.docker.com/compose/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://postgresql.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis)](https://redis.io)

---

## ✨ Features

- 🔐 **JWT Authentication** — Register, login, access & refresh tokens
- 🏆 **Live Leaderboards** — Redis Sorted Sets, updated on every game finish
- 🎲 **Tic-Tac-Toe** — Pass-and-play, game state persisted in MongoDB + Redis
- 🔢 **Guess the Number** — Classic 1–100 guessing game with attempt tracking
- 🌐 **Nginx API Gateway** — Single entry point, routes to all services
- ⚡ **Vite + React SPA** — Fast, dark-mode UI with animated pages

---

## 🏗️ Architecture

```
                    ┌────────────────────────────────────────────┐
                    │         React SPA (Vite + TypeScript)       │
                    │   Home | Login | TicTacToe | GuessNumber    │
                    │   Leaderboard | Auth Context                 │
                    └─────────────────────┬──────────────────────┘
                                          │ HTTP
                    ┌─────────────────────▼──────────────────────┐
                    │          Nginx API Gateway  :3000            │
                    │   /api/auth       → auth-service:3001        │
                    │   /api/leaderboard→ leaderboard-service:3002 │
                    │   /api/tic-tac-toe→ tic-tac-toe-service:3003 │
                    │   /api/guess-number→guess-number-service:3004│
                    │   /              → frontend:80 (React SPA)  │
                    └──┬──────────┬───────────────┬───────────────┘
                       │          │               │
         ┌─────────────▼──┐ ┌────▼──────────┐ ┌─▼───────────────────┐
         │  Auth Service   │ │  Leaderboard  │ │   Game Services      │
         │  Express + TS   │ │  Express + TS │ │  TicTacToe   :3003   │
         │  Prisma + JWT   │ │  Redis + PG   │ │  GuessNumber :3004   │
         └────────┬────────┘ └───────┬───────┘ └─────────────────────┘
                  │                  │                  │
         ┌────────▼──────────────────▼──────────────────▼────────────┐
         │                    Data Layer (Docker Volumes)             │
         │  PostgreSQL 16  — Users, Refresh Tokens, Scores           │
         │  MongoDB 7      — Game Sessions, Move History              │
         │  Redis 7        — Sessions, Leaderboard Sorted Sets,      │
         │                   Game State Cache                         │
         └────────────────────────────────────────────────────────────┘
```

### Services

| Service | Port | Tech | Responsibility |
|---|---|---|---|
| **gateway** | 3000 | Nginx 1.25 | Reverse proxy & routing |
| **frontend** | 80 (internal) | React 18 + Vite + Nginx | SPA served as static files |
| **auth-service** | 3001 (internal) | Express + Prisma + PostgreSQL | Register, login, JWT, refresh tokens |
| **leaderboard-service** | 3002 (internal) | Express + Prisma + Redis | Score submission, ranked leaderboards |
| **tic-tac-toe-service** | 3003 (internal) | Express + Mongoose + Redis | Game logic, state persistence |
| **guess-number-service** | 3004 (internal) | Express + Mongoose + Redis | Guess game, scoring |
| **postgres** | 5432 (internal) | PostgreSQL 16 | Auth users, scores |
| **mongo** | 27017 (internal) | MongoDB 7 | Game sessions, move history |
| **redis** | 6379 (internal) | Redis 7 | Cache, sessions, leaderboards |

---

## 🚀 Quick Start

### Prerequisites

- [Docker Desktop](https://docs.docker.com/desktop/) (with Docker Compose v2)
- Git

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/Games_sk.git
cd Games_sk
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env to set a strong JWT_SECRET before deploying anywhere public
```

### 3. Build & launch

```bash
docker compose up --build
```

> First run takes ~2–3 minutes to build all images. Subsequent starts are fast.

### 4. Open the app

| URL | What |
|---|---|
| http://localhost:3000 | Full app (via gateway) |
| http://localhost:5173 | Vite dev server (frontend only, for dev) |

---

## 🛠️ Development

### Run the frontend in dev mode (hot-reload)

```bash
cd frontend
npm install
npm run dev          # starts at http://localhost:5173
```

> Vite proxies `/api` → `http://localhost:3000`, so keep Docker running for the backend.

### Run a single service locally

```bash
cd services/auth-service
npm install
# Set env vars (see .env.example)
npx prisma db push   # sync schema to local/docker postgres
npm run dev
```

### Re-rebuild only one container (e.g. after code change)

```bash
docker compose build auth-service
docker compose up -d auth-service
```

---

## 📁 Project Structure

```
Games_sk/
├── docker-compose.yml          # Orchestrates all services
├── .env.example                # Template — copy to .env
├── ARCHITECTURE.md             # Deep-dive: data flow, Redis keys, etc.
│
├── frontend/                   # React 18 + Vite SPA
│   ├── src/
│   │   ├── api/                # Axios client
│   │   ├── components/         # Navbar
│   │   ├── context/            # AuthContext (JWT state)
│   │   └── pages/              # Home, Auth, TicTacToe, GuessNumber, Leaderboard
│   └── Dockerfile
│
├── gateway/                    # Nginx reverse proxy
│   ├── conf.d/
│   │   ├── upstream.conf       # Upstream service addresses
│   │   └── routes.conf         # Location → upstream routing
│   └── Dockerfile
│
├── services/
│   ├── auth-service/           # JWT auth + Prisma (PostgreSQL)
│   ├── leaderboard-service/    # Scores + Redis Sorted Sets
│   ├── tic-tac-toe-service/    # TTT logic + MongoDB + Redis
│   └── guess-number-service/   # Guess game + MongoDB + Redis
│
└── packages/
    └── shared-types/           # Shared TypeScript types
```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and set these:

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | `change-me-in-production-min-32-chars` | **Change this!** Signs all JWTs |
| `JWT_EXPIRES_IN` | `15m` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRES_IN` | `7d` | Refresh token lifetime |
| `POSTGRES_USER` | `gamesadmin` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `gamespassword` | PostgreSQL password |
| `POSTGRES_DB` | `gamesplatform` | PostgreSQL database name |
| `MONGO_INITDB_ROOT_USERNAME` | `gamesadmin` | MongoDB root username |
| `MONGO_INITDB_ROOT_PASSWORD` | `gamespassword` | MongoDB root password |
| `GATEWAY_PORT` | `3000` | Host port for the gateway |

---

## 🎮 Adding a New Game

The architecture is designed for easy game additions:

1. **Scaffold** a new service: `cp -r services/tic-tac-toe-service services/my-game-service`
2. **Implement** game logic in `src/game/engine.ts` (pure functions, no side effects)
3. **Register** in `docker-compose.yml` — copy the tic-tac-toe block, change port & name
4. **Route** in `gateway/conf.d/routes.conf` — add a `location /api/my-game/` block
5. **Build UI** — add a page in `frontend/src/pages/` and a card in `HomePage.tsx`

Zero changes to auth-service, leaderboard-service, or gateway logic needed.

---

## 🐛 Troubleshooting

**"Failed to load leaderboard"**  
→ The `scores` table may not exist. Run:
```bash
docker exec games_sk-leaderboard-service-1 npx prisma db push --accept-data-loss
```

**"Registration failed" / "Failed to create game"**  
→ Backend services may not be healthy yet. Check:
```bash
docker compose ps        # all should be "healthy"
docker compose logs -f   # watch for errors
```

**Port 3000 already in use**  
→ Set `GATEWAY_PORT=3001` in `.env` and restart.

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.
