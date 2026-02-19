<div align="center">

<img src="apps/web/public/icon0.svg" alt="concord" width="120">

<h1>concord</h1>

**Open source community platform — self-hosted Discord alternative built in TypeScript.**

</div>

<p align="center">
  <a href="https://github.com/CodesWhat/concord/releases"><img src="https://img.shields.io/badge/version-0.3.0-blue" alt="Version"></a>
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

> **Concord** is a self-hosted, open-source Discord alternative. Familiar enough to feel like home, better enough to justify the switch. One `docker compose up` to own your community's data. AGPL-3.0, no CLA.

<br>

> **Screenshots coming soon** — in the meantime, try `docker compose -f docker/docker-compose.yml up -d` and see for yourself!

<br>

<h3 align="center">Contents</h3>

- [What is Concord?](#what-is-concord)
- [Quick Start (Self-Host)](#quick-start-self-host)
- [Features](#features)
- [Configuration](#configuration)
- [Development](#development)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

---

<br>

<h3 align="center" id="what-is-concord">What is Concord?</h3>

Concord is a self-hosted, open-source community platform built as a drop-in Discord replacement. Run it on your own server in minutes with a single `docker compose up`. You own your data, your community, and your future — no vendor lock-in, no data mining, no proprietary walls.

It ships with real-time chat, forum channels (Reddit-style), file uploads, role-based permissions, push notifications, and more. AGPL-3.0 licensed with no CLA — your contributions stay yours and can never be relicensed.

---

<br>

<h3 align="center" id="quick-start-self-host">Quick Start (Self-Host)</h3>

**Prerequisites:** Docker and Docker Compose.

```bash
git clone https://github.com/CodesWhat/concord.git
cd concord
docker compose -f docker/docker-compose.yml up -d
```

Then open [http://localhost:8080](http://localhost:8080). The database migrates automatically on startup. Register a new account to get started — the first user to create a server becomes its owner.

<details>
<summary><strong>S3 storage setup (Garage)</strong></summary>

The Docker Compose stack includes [Garage](https://garagehq.deuxfleurs.fr/) for S3-compatible file storage. After first start, create the bucket:

```bash
# Connect to the Garage admin API and set up the cluster
docker compose -f docker/docker-compose.yml exec garage /garage node id 2>/dev/null | head -1
# Use the node ID from above:
docker compose -f docker/docker-compose.yml exec garage /garage layout assign -z dc1 -c 1G <NODE_ID>
docker compose -f docker/docker-compose.yml exec garage /garage layout apply --version 1

# Create an API key and bucket
docker compose -f docker/docker-compose.yml exec garage /garage key create concord-key
docker compose -f docker/docker-compose.yml exec garage /garage bucket create concord
docker compose -f docker/docker-compose.yml exec garage /garage bucket allow concord --read --write --key concord-key
```

Update the `S3_ACCESS_KEY` and `S3_SECRET_KEY` in `docker/docker-compose.yml` with the key ID and secret from the `key create` output.

</details>

**Optional configuration:** For Docker, edit the environment variables directly in `docker/docker-compose.yml`. For local development, copy `apps/api/.env.example` to `apps/api/.env`. Set your SMTP credentials for email delivery, S3 details for file uploads, and VAPID keys for push notifications. See the [Configuration](#configuration) section for all available variables.

---

<br>

<h3 align="center" id="features">Features</h3>

<details>
<summary><strong>Chat & Messaging</strong></summary>

- **Real-time messaging** — WebSocket gateway with instant delivery, edit, delete, and "(edited)" tags
- **Threads** — Threaded replies within channels
- **Typing indicators** — Animated "X is typing..." bar with 8-second auto-expire
- **Presence tracking** — Live online/idle/DND/invisible status synced across all clients
- **Markdown rendering** — Code blocks, links, lists, tables, task lists via react-markdown
- **Unread tracking** — Per-channel unread counts with mention badges
- **Slowmode** — Per-channel message rate limiting enforced server-side

</details>

<details>
<summary><strong>Files & Media</strong></summary>

- **File uploads** — Drag and drop, paste, or click to upload; S3-backed storage
- **Avatar upload** — User profile avatars stored in S3

</details>

<details>
<summary><strong>Forum Channels</strong></summary>

- **Reddit-style forums** — Forum channel type alongside text channels
- **Voting** — Upvote/downvote posts with live vote counts
- **Comments** — Nested comments on forum posts
- **Post management** — Create, edit, and delete forum posts

</details>

<details>
<summary><strong>Roles & Permissions</strong></summary>

- **Role-based permissions** — Bitmask permission system with named roles
- **Channel overrides** — Per-channel permission overrides per role
- **Role hierarchy** — Enforcement prevents users from acting above their role
- **Kick & ban** — Kick or ban members with hierarchy checks; ban list with unban support

</details>

<details>
<summary><strong>Servers & Invites</strong></summary>

- **Server management** — Create, join, edit, and delete servers
- **Invite links** — Shareable invite codes with configurable expiry and usage limits
- **Leave server** — Members can leave servers; wrapped in a transaction for safety

</details>

<details>
<summary><strong>Notifications & Communication</strong></summary>

- **Push notifications** — Web Push for @mentions; works on desktop and mobile
- **Password reset** — Email-based forgot-password flow via configurable SMTP

</details>

<details>
<summary><strong>User Experience</strong></summary>

- **User profiles** — Bio, avatar, display name, status
- **Quick switcher** — Cmd+K fuzzy search across servers and channels
- **PWA installable** — Install as a native app on desktop and mobile
- **Responsive UI** — 4-panel desktop layout with mobile-optimized bottom navigation

</details>

<details>
<summary><strong>Operations</strong></summary>

- **Auto-migration** — Database migrations run automatically on API startup
- **Rate limiting** — Global and per-route rate limits via @fastify/rate-limit
- **S3-compatible storage** — Works with MinIO, Cloudflare R2, AWS S3, or any compatible provider

</details>

---

<br>

<h3 align="center" id="configuration">Configuration</h3>

For Docker deployments, set these in `docker/docker-compose.yml`. For local development, copy `apps/api/.env.example` to `apps/api/.env`:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `AUTH_SECRET` | Secret for session/auth token signing (required) |
| `CORS_ORIGIN` | Allowed frontend origin (e.g. `https://concord.example.com`) |
| `SMTP_HOST` | SMTP server host for email delivery |
| `SMTP_PORT` | SMTP server port (typically 587 or 465) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | From address for outgoing emails |
| `S3_ENDPOINT` | S3-compatible storage endpoint (e.g. `https://s3.amazonaws.com`) |
| `S3_BUCKET` | Storage bucket name |
| `S3_ACCESS_KEY` | Storage access key |
| `S3_SECRET_KEY` | Storage secret key |
| `VAPID_PUBLIC_KEY` | VAPID public key for Web Push notifications |
| `VAPID_PRIVATE_KEY` | VAPID private key for Web Push notifications |
| `VAPID_SUBJECT` | VAPID subject (e.g. `mailto:admin@example.com`) |

---

<br>

<h3 align="center" id="development">Development</h3>

**Prerequisites:** Node.js 22+, pnpm 10+, Docker (for Postgres, Redis, and MinIO)

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

```bash
# Run all apps in dev mode (web + api)
pnpm dev

# Build all packages
pnpm build

# Run database migrations
cd apps/api && pnpm drizzle-kit push

# Generate a new migration
cd apps/api && pnpm drizzle-kit generate
```

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
└── docker/           # Docker Compose for dev and production
```

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 6, Tailwind CSS v4, Zustand |
| Backend | Fastify 5, TypeScript, Drizzle ORM |
| Database | PostgreSQL 17, Redis 7 |
| Auth | Better Auth (session-based, Drizzle adapter) |
| Real-time | WebSocket (`ws`), Redis pub/sub for fan-out |
| IDs | Snowflake (64-bit, custom epoch 2026-01-01) |
| Storage | S3-compatible (MinIO, AWS S3, Cloudflare R2) |

---

<br>

<h3 align="center" id="contributing">Contributing</h3>

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code style, and the PR process.

This project is AGPL-3.0 with **no CLA** — your contributions can never be relicensed.

---

<br>

<h3 align="center" id="license">License</h3>

[AGPL-3.0](LICENSE) — no CLA. By contributing, you agree your contributions will be licensed under the same terms. Your code stays yours.

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
