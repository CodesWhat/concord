# Contributing to Concord

Thanks for your interest in contributing. Concord is AGPL-3.0 with **no CLA** — your contributions stay under the same license and can never be relicensed.

## Prerequisites

- **Node.js 22+**
- **pnpm 10+**
- **Docker** — for Postgres, Redis, and MinIO (S3)

## Getting started

```bash
# Clone your fork
git clone https://github.com/<you>/concord.git
cd concord

# Install dependencies
pnpm install

# Start dev services (Postgres 17, Redis 7, MinIO)
docker compose -f docker/docker-compose.dev.yml up -d

# Copy environment config
cp apps/api/.env.example apps/api/.env

# Run database migrations
cd apps/api && pnpm drizzle-kit push && cd ../..

# Start dev servers (web + api)
pnpm dev
```

Web runs on `http://localhost:5173`, API on port 3000 (proxied through Vite).

## Project structure

```
concord/
├── apps/
│   ├── web/          # React 19 + Vite 6 + Tailwind CSS v4
│   └── api/          # Fastify 5 + Drizzle ORM + WebSocket gateway
├── packages/
│   └── shared/       # Shared types, permissions, snowflake utilities
└── docker/           # Docker Compose for dev services
```

## Code style

- **TypeScript strict** — no `any`, typed parameters and return types everywhere
- **Tailwind CSS v4** — uses `@theme` in CSS, not `tailwind.config`
- **Small files** — no file exceeds ~300 lines
- **Service layer separation** — routes handle HTTP, services handle business logic
- **`ServiceResult<T>` pattern** — `{ data, error }` tuples instead of thrown exceptions

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) with emoji prefixes:

| Prefix | Usage |
| --- | --- |
| `✨ feat:` | New feature |
| `🐛 fix:` | Bug fix |
| `📦 chore:` | Maintenance, deps |
| `♻️ refactor:` | Code restructuring |
| `🎨 style:` | Formatting, UI tweaks |
| `📝 docs:` | Documentation |

Keep commits focused and atomic — one logical change per commit.

## Pull request process

1. **Fork** the repository
2. **Branch from `main`** — use descriptive names (`feat/thread-mentions`, `fix/ws-reconnect`)
3. **Make your changes** — follow the code style above
4. **Build passes** — run `pnpm build` before submitting
5. **Open a PR** against `main` with a description of what changed and why

We'll review as quickly as we can. Small, focused PRs merge faster.

## Reporting bugs

Open a [GitHub Issue](https://github.com/CodesWhat/concord/issues) with steps to reproduce.

## Security vulnerabilities

**Do not open a public issue.** See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE).
