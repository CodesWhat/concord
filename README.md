<div align="center">

<img src="apps/web/public/icon0.svg" alt="concord" width="120">

<h1>concord</h1>

**Open source community platform — self-hosted Discord alternative built in TypeScript.**

</div>

<p align="center">
  <a href="https://github.com/CodesWhat/concord/releases"><img src="https://img.shields.io/badge/version-0.1.0-blue" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-C9A227" alt="License AGPL-3.0"></a>
  <a href="https://github.com/CodesWhat/concord"><img src="https://img.shields.io/badge/status-alpha-orange" alt="Status"></a>
</p>

<p align="center">
  <a href="https://github.com/CodesWhat/concord/stargazers"><img src="https://img.shields.io/github/stars/CodesWhat/concord?style=flat" alt="Stars"></a>
  <a href="https://github.com/CodesWhat/concord/forks"><img src="https://img.shields.io/github/forks/CodesWhat/concord?style=flat" alt="Forks"></a>
  <a href="https://github.com/CodesWhat/concord/issues"><img src="https://img.shields.io/github/issues/CodesWhat/concord?style=flat" alt="Issues"></a>
  <a href="https://github.com/CodesWhat/concord/commits/main"><img src="https://img.shields.io/github/last-commit/CodesWhat/concord?style=flat" alt="Last commit"></a>
</p>

<br>

> **Concord** is a self-hostable, open source community chat platform. Familiar enough to feel like home, better enough to justify the switch. One `docker compose up` to own your community's data.

<br>

<h3 align="center">Contents</h3>

- [Quick Start](#quick-start)
- [Features](#features)
- [Architecture](#architecture)
- [Development](#development)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Documentation](#documentation)

---

<br>

<h3 align="center" id="quick-start">Quick Start</h3>

**Prerequisites:** Node.js 22+, pnpm 9+, Docker (for Postgres + Redis)

```bash
# Clone
git clone https://github.com/CodesWhat/concord.git
cd concord

# Install dependencies
pnpm install

# Start database services
docker compose -f docker/docker-compose.dev.yml up -d

# Copy environment config
cp apps/api/.env.example apps/api/.env

# Run database migrations
cd apps/api && pnpm drizzle-kit push && cd ../..

# Seed sample data (optional)
cd apps/api && pnpm tsx src/seed.ts && cd ../..

# Start development servers
pnpm dev
```

Then open [http://localhost:5173](http://localhost:5173) — the API runs on port 3000, proxied through Vite.

<details>
<summary><strong>Default seed accounts</strong></summary>

| Email | Password | Role |
| --- | --- | --- |
| `admin@concord.local` | `password123` | Server owner |
| `testuser@concord.local` | `password123` | Member |

</details>

---

<br>

<h3 align="center" id="features">Features</h3>

Real-time text chat with a Discord-familiar interface, built from scratch with modern tooling.

<details>
<summary><strong>What's included in v0.1.0</strong></summary>

- **Authentication** — Email/password signup and login via Better Auth with session management
- **Server Management** — Create, join, and manage community servers with roles and permissions
- **Channels** — Text channels organized in collapsible categories
- **Real-time Messaging** — WebSocket gateway with instant message delivery and presence tracking
- **Permission System** — Bitmask-based role permissions (manage server, manage channels, kick/ban members, etc.)
- **Invite System** — Shareable invite codes with expiration and usage limits
- **Snowflake IDs** — Twitter-style 64-bit sortable IDs for messages (custom epoch 2026-01-01)
- **Responsive UI** — Desktop 4-panel layout with mobile-optimized views and bottom navigation
- **PWA Ready** — Web app manifest, favicons, and mobile-first meta tags

</details>

---

<br>

<h3 align="center" id="architecture">Architecture</h3>

Turborepo monorepo with three packages:

```
concord/
├── apps/
│   ├── web/          # React 19 + Vite 6 + Tailwind CSS v4
│   └── api/          # Fastify 5 + Drizzle ORM + WebSocket gateway
├── packages/
│   ├── shared/       # Shared types, permissions, snowflake utilities
│   └── config/       # Shared ESLint + TypeScript config
└── docker/           # Docker Compose for dev services
```

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 6, Tailwind CSS v4, Zustand |
| Backend | Fastify 5, TypeScript, Drizzle ORM |
| Database | PostgreSQL 17, Redis 7 |
| Auth | Better Auth (session-based, Drizzle adapter) |
| Real-time | WebSocket (`ws`), Redis pub/sub for fan-out |
| IDs | Snowflake (64-bit, custom epoch) |

---

<br>

<h3 align="center" id="development">Development</h3>

```bash
# Run all apps in dev mode (web + api)
pnpm dev

# Build all packages
pnpm build

# Run database migrations
cd apps/api && pnpm drizzle-kit push

# Generate a new migration
cd apps/api && pnpm drizzle-kit generate

# Seed the database
cd apps/api && pnpm tsx src/seed.ts
```

<details>
<summary><strong>Environment variables</strong></summary>

Copy `apps/api/.env.example` to `apps/api/.env`. All variables:

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://concord:concord@localhost:5432/concord` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `JWT_SECRET` | — | Secret for auth token signing |
| `LIVEKIT_URL` | — | LiveKit server URL (Phase 2) |
| `LIVEKIT_API_KEY` | — | LiveKit API key (Phase 2) |
| `LIVEKIT_API_SECRET` | — | LiveKit API secret (Phase 2) |
| `S3_ENDPOINT` | — | S3-compatible storage endpoint (Phase 1) |
| `S3_BUCKET` | — | Storage bucket name |
| `S3_ACCESS_KEY` | — | Storage access key |
| `S3_SECRET_KEY` | — | Storage secret key |

</details>

<details>
<summary><strong>Project conventions</strong></summary>

- **Small, single-purpose files** — No file exceeds ~300 lines
- **Explicit types** — No `any`, typed parameters and return types everywhere
- **One route per file** — `routes/messages.ts` handles all message endpoints
- **Service layer separation** — Routes handle HTTP, services handle business logic
- **`ServiceResult<T>` pattern** — `{ data, error }` tuples instead of thrown exceptions
- **Colocated tests** — `routes/messages.ts` → `routes/messages.test.ts`

</details>

---

<br>

<h3 align="center" id="roadmap">Roadmap</h3>

| Version | Phase | Highlights |
| --- | --- | --- |
| **v0.1.0** | Foundation | Auth, database, REST API, WebSocket gateway, chat UI |
| **v0.2.0** | Chat MVP | Threads, file uploads, enhanced permissions, invite flow, PWA shell |
| **v0.3.0** | Forum Channels | Reddit-style forum channel type with upvotes, nested comments, public readability toggle |
| **v0.4.0** | Voice & Moderation | LiveKit voice/video, screensharing, mod tools, automod, push notifications |
| **v0.5.0** | Polish & Scale | Performance, bot API, search with operators, knowledge base features |
| **v1.0.0** | Ecosystem | Discord migration tools, E2EE for DMs, plugin system, custom themes |

---

<br>

<h3 align="center" id="contributing">Contributing</h3>

Contributions are welcome! This project is AGPL-3.0 with **no CLA** — your contributions can never be relicensed.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, etc.)
4. Push and open a Pull Request

---

<br>

<h3 align="center" id="documentation">Documentation</h3>

| Resource | Link |
| --- | --- |
| Roadmap | [ROADMAP.md](ROADMAP.md) |
| Specification | [spec.md](spec.md) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |
| Issues | [GitHub Issues](https://github.com/CodesWhat/concord/issues) |
| Discussions | [GitHub Discussions](https://github.com/CodesWhat/concord/discussions) |

---

<br>

<div align="center">

[![SemVer](https://img.shields.io/badge/semver-2.0.0-blue)](https://semver.org/)
[![Conventional Commits](https://img.shields.io/badge/commits-conventional-fe5196?logo=conventionalcommits&logoColor=fff)](https://www.conventionalcommits.org/)
[![Keep a Changelog](https://img.shields.io/badge/changelog-Keep%20a%20Changelog-E05735)](https://keepachangelog.com/)

### Built With

[![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React_19-087EA4?logo=react&logoColor=fff)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite_6-646CFF?logo=vite&logoColor=fff)](https://vite.dev/)
[![Fastify](https://img.shields.io/badge/Fastify_5-000?logo=fastify&logoColor=fff)](https://fastify.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL_17-4169E1?logo=postgresql&logoColor=fff)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis_7-FF4438?logo=redis&logoColor=fff)](https://redis.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?logo=tailwindcss&logoColor=fff)](https://tailwindcss.com/)
[![Claude](https://img.shields.io/badge/Claude-000000?style=flat&logo=anthropic&logoColor=white)](https://claude.ai/)

---

**[AGPL-3.0 License](LICENSE)**

<a href="https://github.com/CodesWhat"><img src="https://img.shields.io/badge/CodesWhat-000?logo=github&logoColor=white" alt="CodesWhat" height="22"></a>

<p>
  <a href="https://ko-fi.com/codeswhat"><img src="https://img.shields.io/badge/Ko--fi-Support-ff5e5b?logo=kofi&logoColor=white" alt="Ko-fi"></a>
  <a href="https://buymeacoffee.com/codeswhat"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buymeacoffee&logoColor=black" alt="Buy Me a Coffee"></a>
  <a href="https://github.com/sponsors/CodesWhat"><img src="https://img.shields.io/badge/Sponsor-ea4aaa?logo=githubsponsors&logoColor=white" alt="GitHub Sponsors"></a>
</p>

<a href="#concord">Back to top</a>

</div>
