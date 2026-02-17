# Concord — Open-Source Community Platform

## Project Spec v0.5

**Name:** Concord
**Logo:** Concord grape (stylized, modern)
**Brand color:** Purple — a deliberate nod to Discord's palette, easing visual transition for migrating communities
**License:** AGPL-3.0 (no CLA — avoiding the rugpull pattern. See: Movim as prior art for AGPL-no-CLA in chat space.)
**Status:** Draft

---

## 1. Vision

Concord is a self-hostable, open-source community platform built as a direct replacement for Discord. It supports all community sizes — from small friend groups to servers with tens of thousands of active users — without compromising on UX, moderation, or real-time features.

The name says it all: Discord means conflict, Concord means harmony. Communities deserve infrastructure they control, with onboarding simple enough that non-technical users never notice it isn't Discord.

---

## 2. Hard Requirements (from analysis)

These are non-negotiable for v1.0:

| Requirement | Details |
|---|---|
| **Discord-like onboarding UX** | New users must be able to join a community, read channels, and start chatting within 60 seconds. No bouncer setup, no key verification ceremony. Invite-link join works without email verification by default (instance admins can require it). Stoat lost users to a broken email verification flow — we don't repeat that. |
| **Multiple text & voice channels** | Organized by categories. Channels support threads. Voice channels are persistent (hop in/out, not call-based). |
| **Cross-platform access** | PWA at launch (iOS + Android + desktop). Native apps can follow. |
| **Self-hostable** | Single `docker compose up` for a fully functional instance. No enterprise paywalls on core features. |
| **Scales to 50k+ members** | Must handle servers with thousands of concurrent users without melting. |
| **Moderation tools** | Bans, kicks, mutes, slowmode, audit logs, role-based permissions, automod hooks. |
| **Predictable resource scaling** | Resource usage must scale linearly and predictably with user count. No surprise memory balloons from federation joins or background sync. Fluxer required 8c/16GB to self-host — we target 2GB idle for small instances. |

---

## 3. Nice-to-Have Features (post-v1.0 candidates)

| Feature | Priority | Notes |
|---|---|---|
| End-to-end encryption (DMs & small groups) | High | Opt-in for DMs and small groups only. Explicitly NOT default for server channels. Community consensus confirms Matrix's E2EE causes more UX problems than it solves at scale (disappearing messages, verification ceremony confusion). |
| TTL-ed messages | Medium | Configurable per-channel. Default: indefinite. Options: 30d, 90d, 1y, indefinite. |
| Screensharing & video chat | High | Via LiveKit. |
| Bot/integration API | High | Discord-compatible API shim would accelerate migration. |
| Knowledge base / pinned docs | High | Discord is terrible for persistent information (top community complaint, 155+ upvotes). Not a full forum — but structured, searchable, pinnable docs per channel/server. Think "wiki-lite" or enhanced pinned messages. Chat is ephemeral; knowledge should persist. |
| Custom emoji & stickers | Medium | Community identity matters. |
| Federation | Low | Interesting but not a launch priority. Opens massive complexity. |
| Plugin system | Medium | Allow communities to extend functionality without forking. Plugin hooks for things like age verification, proof-of-human, and custom automod. |

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                     Clients                          │
│  PWA (React)  ·  Desktop (Electron/Tauri, later)     │
└──────────────────────┬──────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            │   API Gateway /     │
            │   WebSocket Hub     │
            │   (Node.js)         │
            └──────────┬──────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐
│  REST API   │ │  Realtime   │ │  Media      │
│  Service    │ │  Service    │ │  Service    │
│  (Node.js)  │ │  (Node.js)  │ │  (LiveKit)  │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │
       └───────────────┼───────────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐
│ PostgreSQL  │ │   Redis     │ │  S3/MinIO   │
│ (data)      │ │ (pub/sub +  │ │ (files,     │
│             │ │  presence + │ │  avatars,   │
│             │ │  cache)     │ │  attachments│
└─────────────┘ └─────────────┘ └─────────────┘
```

### 4.1 Why This Stack

**Node.js (TypeScript) for backend services:**
- Fastest path to a working product given your experience and AI agent workflows.
- Excellent WebSocket ecosystem (`ws`, `socket.io`).
- Shared language with the frontend reduces context switching.
- If hot paths become bottlenecks at scale, they can be extracted into Rust/Go microservices later. Premature optimization of language choice is how Matrix ended up with Synapse → Dendrite → Synapse Pro and shipped nothing.

**React + Vite for the PWA (NOT Next.js):**
- A chat app is a single-page application, not a content site. SSR adds complexity with zero benefit here — there's nothing to SEO-index behind an auth wall.
- Vite gives fast HMR, simple config, and clean PWA support via `vite-plugin-pwa`.
- React because it's what you know, the ecosystem is massive, and hiring/contributors are plentiful.

**PostgreSQL:**
- Battle-tested relational store for messages, users, servers, channels, roles, permissions.
- JSONB for flexible metadata without a schema migration for every new feature.
- Partitioning by server/time for message tables to handle scale.

**Redis:**
- Pub/sub for real-time event fan-out across service instances.
- Presence tracking (who's online, who's in what voice channel).
- Rate limiting and session cache.

**LiveKit for voice/video/screenshare:**
- Open-source WebRTC SFU purpose-built for this.
- Handles the hard parts: voice channels (persistent rooms users hop in/out of), screensharing, video, simulcast for bandwidth adaptation.
- Self-hostable alongside the rest of the stack.
- SDKs for React and mobile.

**MinIO (S3-compatible) for file storage:**
- Avatars, attachments, emoji, stickers.
- Self-hostable. Drop-in replacement for AWS S3 if someone wants cloud hosting.

---

## 5. Data Model (Core Entities)

```
User
├── id (uuid)
├── username (unique, alphanumeric + underscores)
├── display_name
├── avatar_url
├── email (hashed for auth, not publicly exposed)
├── password_hash (argon2id)
├── status (online | idle | dnd | offline)
├── created_at
└── flags (admin, bot, etc.)

Server (equivalent to a Discord "server/guild")
├── id (uuid)
├── name
├── icon_url
├── owner_id → User
├── description
├── created_at
├── settings (jsonb: default_ttl, verification_level, etc.)
└── invite_codes[]

Category
├── id (uuid)
├── server_id → Server
├── name
├── position (int)
└── permission_overrides (jsonb)

Channel
├── id (uuid)
├── server_id → Server
├── category_id → Category (nullable)
├── type (text | voice | announcement | stage)
├── name
├── topic
├── position (int)
├── ttl_seconds (nullable — overrides server default)
├── slowmode_seconds (default: 0)
├── nsfw (boolean)
└── permission_overrides (jsonb)

Message
├── id (snowflake — time-sortable, unique)
├── channel_id → Channel
├── author_id → User
├── content (text, max 4000 chars)
├── attachments (jsonb array)
├── embeds (jsonb array)
├── reply_to_id → Message (nullable)
├── thread_id → Thread (nullable)
├── edited_at (nullable)
├── deleted (boolean, soft delete)
├── created_at
└── reactions (jsonb or separate table)

Thread
├── id (uuid)
├── parent_message_id → Message
├── channel_id → Channel
├── name
├── archived (boolean)
├── auto_archive_after (duration)
└── created_at

Role
├── id (uuid)
├── server_id → Server
├── name
├── color (hex)
├── position (int, for hierarchy)
├── permissions (bigint bitmask)
├── mentionable (boolean)
└── hoisted (boolean — show separately in member list)

ServerMember
├── user_id → User
├── server_id → Server
├── nickname (nullable)
├── roles[] → Role
├── joined_at
└── muted / deafened (for voice state)

Invite
├── code (short string)
├── server_id → Server
├── channel_id → Channel
├── creator_id → User
├── max_uses (nullable)
├── uses (int)
├── expires_at (nullable)
└── created_at
```

### 5.1 Message IDs: Snowflakes

Follow Discord's approach: 64-bit IDs encoding timestamp + worker ID + sequence. This gives time-ordered, unique, distributed ID generation without a central coordination point. Critical for message pagination and sorting at scale.

### 5.2 Permissions Model

Bitmask-based, matching Discord's model closely:

```
MANAGE_SERVER         = 1 << 0
MANAGE_CHANNELS       = 1 << 1
MANAGE_ROLES          = 1 << 2
KICK_MEMBERS          = 1 << 3
BAN_MEMBERS           = 1 << 4
MANAGE_MESSAGES       = 1 << 5
SEND_MESSAGES         = 1 << 6
READ_MESSAGES         = 1 << 7
EMBED_LINKS           = 1 << 8
ATTACH_FILES          = 1 << 9
MENTION_EVERYONE      = 1 << 10
ADD_REACTIONS         = 1 << 11
CONNECT_VOICE         = 1 << 12
SPEAK                 = 1 << 13
MUTE_MEMBERS          = 1 << 14
DEAFEN_MEMBERS        = 1 << 15
MOVE_MEMBERS          = 1 << 16
USE_VOICE_ACTIVITY    = 1 << 17
MANAGE_WEBHOOKS       = 1 << 18
MANAGE_EMOJIS         = 1 << 19
CREATE_INVITES        = 1 << 20
VIEW_AUDIT_LOG        = 1 << 21
MANAGE_THREADS        = 1 << 22
SEND_MESSAGES_THREADS = 1 << 23
STREAM                = 1 << 24  // screenshare
ADMINISTRATOR         = 1 << 30
```

Permission resolution order: server-level role permissions → category overrides → channel overrides, with explicit denies taking precedence.

---

## 6. Real-Time Protocol

### 6.1 WebSocket Gateway

Clients maintain a persistent WebSocket connection to the gateway. The protocol uses JSON messages (binary/msgpack optimization can come later).

**Connection flow:**
1. Client connects to `wss://gateway.concord.example/`
2. Server sends `HELLO` with heartbeat interval
3. Client sends `IDENTIFY` with auth token
4. Server sends `READY` with user data, server list, channel list, initial presence
5. Client and server exchange heartbeats to maintain connection
6. Server pushes events; client sends actions

**Core event types (server → client):**
```
MESSAGE_CREATE, MESSAGE_UPDATE, MESSAGE_DELETE
CHANNEL_CREATE, CHANNEL_UPDATE, CHANNEL_DELETE
MEMBER_JOIN, MEMBER_LEAVE, MEMBER_UPDATE
PRESENCE_UPDATE
TYPING_START
VOICE_STATE_UPDATE
REACTION_ADD, REACTION_REMOVE
SERVER_UPDATE
THREAD_CREATE, THREAD_UPDATE
```

**Core actions (client → server):**
```
HEARTBEAT
IDENTIFY
RESUME (reconnection with sequence number)
REQUEST_MEMBERS (lazy-load member list)
UPDATE_PRESENCE
UPDATE_VOICE_STATE
```

### 6.2 Event Fan-Out Strategy

This is the hardest scaling problem. A message in a server with 50,000 members doesn't mean 50,000 WebSocket writes.

**Approach: Lazy subscriptions + presence-aware fan-out**
- Clients only subscribe to channels they're currently viewing (plus a small buffer of recently viewed channels).
- Unread counts and mention badges are pushed via a lightweight "summary" subscription per server.
- Redis pub/sub handles cross-instance event distribution.
- For very large servers: shard the gateway by server ID so all members of a server connect to the same gateway cluster.

---

## 7. Voice & Media (LiveKit)

### 7.1 Voice Channel Model

Voice channels in Concord work like Discord's: persistent rooms that users join and leave freely.

**Implementation:**
- Each voice channel maps to a LiveKit room.
- Rooms are lazily created when the first user joins and destroyed when the last user leaves.
- The Concord backend manages LiveKit room tokens, enforcing permissions (who can speak, who can screenshare, etc.).
- Voice state is synced to all server members via `VOICE_STATE_UPDATE` gateway events.

**Flow:**
1. Client sends `UPDATE_VOICE_STATE` with target channel ID.
2. Backend validates permissions, generates a LiveKit join token.
3. Backend returns the LiveKit server URL + token to the client.
4. Client connects directly to LiveKit for media.
5. Backend broadcasts `VOICE_STATE_UPDATE` to the server.

### 7.2 Screensharing & Video

- LiveKit handles screenshare tracks natively.
- Permissions gated by `STREAM` permission bit.
- "Go Live" feature: user publishes a screen track to the voice channel's LiveKit room.
- Viewers subscribe to the track. LiveKit handles simulcast for bandwidth adaptation.
- Video chat: same as voice but with camera tracks published.

---

## 8. Moderation System

### 8.1 Core Tools

| Tool | Description |
|---|---|
| **Ban** | Remove user + delete recent messages. IP-based optional. |
| **Kick** | Remove user without ban. |
| **Mute** | Prevent user from sending messages (timed or indefinite). |
| **Slowmode** | Per-channel message rate limit. |
| **Channel lockdown** | Temporarily revoke send permissions for @everyone. |
| **Audit log** | Every moderation action logged with actor, target, reason, timestamp. |
| **Message reporting** | Users can flag messages for mod review. |
| **Automod hooks** | Webhook-based system for custom automod bots. |

### 8.2 Automod (Built-In)

A rule engine that runs on every message before it's persisted:

- **Word filters** — regex-based blocklists with configurable actions (delete, warn, mute).
- **Spam detection** — rate limiting per user, duplicate message detection, mention spam.
- **Link filtering** — allowlist/blocklist domains, require link previews.
- **Account age gating** — new accounts can be restricted for a configurable period.
- **Raid detection** — spike in joins triggers lockdown mode (require approval for new joins).

---

## 9. Bot & Integration API

### 9.1 HTTP REST API

RESTful, versioned (`/api/v1/`). Mirrors Discord's API structure closely to lower migration friction for bot developers.

**Key endpoints:**
```
GET    /api/v1/servers/:id
GET    /api/v1/channels/:id/messages?before=&limit=
POST   /api/v1/channels/:id/messages
PATCH  /api/v1/channels/:id/messages/:id
DELETE /api/v1/channels/:id/messages/:id
PUT    /api/v1/servers/:id/bans/:userId
GET    /api/v1/servers/:id/members
...
```

### 9.2 Bot Accounts

- Bots authenticate with a token (like Discord bot tokens).
- Bots connect to the same WebSocket gateway as users, receiving events they have permission to see.
- OAuth2 flow for third-party bot installation.

### 9.3 Webhooks

- Incoming webhooks: POST a JSON payload to a channel (for integrations like GitHub notifications).
- Outgoing webhooks: Concord POSTs to an external URL on configurable events.

### 9.4 Discord API Compatibility Layer (future)

A stretch goal: a translation layer that accepts Discord API calls and maps them to Concord's API. This would allow existing Discord bots to work with Concord with minimal changes.

---

## 10. Self-Hosting & Deployment

### 10.1 Deployment Targets

**Primary: Docker Compose (self-hosted)** — Single `docker compose up` for a fully functional instance. This is the core promise of the project.

**Development / Managed tier: Railway** — All services (API, gateway, Postgres, Redis, web frontend) deploy to Railway as a single project. Railway supports WebSockets natively, runs long-running processes, and can deploy directly from Docker. LiveKit Cloud (free tier) handles media during development; self-hosted LiveKit for production.

```
Railway Project: concord
├── concord-api        (Dockerfile, ports 3000 + 3001)
├── concord-web        (Dockerfile, port 80)
├── PostgreSQL         (Railway managed)
├── Redis              (Railway managed)
└── LiveKit            → LiveKit Cloud (external, free tier for dev)
```

Domain: `concord.codeswhat.com` pointed at Railway for now.

File storage: Cloudflare R2 (S3-compatible, free egress) for managed deployment. MinIO for self-hosted.

### 10.2 Self-Hosted Docker Compose

```yaml
# docker-compose.yml (simplified)
services:
  concord-api:
    image: concord/api:latest
    environment:
      DATABASE_URL: postgres://...
      REDIS_URL: redis://...
      LIVEKIT_URL: ws://livekit:7880
      LIVEKIT_API_KEY: ...
      LIVEKIT_API_SECRET: ...
      S3_ENDPOINT: http://minio:9000
      S3_BUCKET: concord
      S3_ACCESS_KEY: ...
      S3_SECRET_KEY: ...
    ports:
      - "3000:3000"   # HTTP API
      - "3001:3001"   # WebSocket Gateway

  concord-web:
    image: concord/web:latest
    ports:
      - "8080:80"

  postgres:
    image: postgres:17
    volumes:
      - pg_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  livekit:
    image: livekit/livekit-server:latest
    ports:
      - "7880:7880"   # WebSocket
      - "7881:7881"   # RTC (TCP)
      - "7882:7882/udp" # RTC (UDP)

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

volumes:
  pg_data:
  minio_data:
```

**Target: `docker compose up` and you have a working instance.** No 47-step install guide. No "contact sales for voice support."

### 10.2 Resource Targets

| Scale | Users | RAM | CPU | Storage |
|---|---|---|---|---|
| Small (friend group) | <100 | 2 GB | 2 cores | 10 GB |
| Medium (community) | 1,000–10,000 | 8 GB | 4 cores | 100 GB |
| Large (mega-server) | 10,000–100,000 | 32 GB+ | 8+ cores | 500 GB+ |

The idle memory for a single-user instance must stay **under 512 MB**. This is a direct response to Matrix/Synapse's 3–4 GB footprint and Fluxer's 16 GB self-hosting requirement. One Matrix user reported stable operation with 40 users on a 4vCPU/8GB VPS at under 1GB RAM — that's our floor, not our ceiling. If we can't run comfortably on a $5/mo VPS for small deployments, we've failed.

**Design principle: predictable scaling.** Resource usage should grow linearly with active users and message volume, not spike unpredictably from background processes, federation syncs, or room state resolution. Every background task must have bounded memory usage and configurable concurrency limits.

---

## 11. Authentication

### 11.1 Local Auth

- Email + password registration (argon2id hashing).
- Email verification (optional, configurable by instance admin).
- TOTP-based 2FA.

### 11.2 SSO / OAuth2 (Optional)

Instance admins can configure external identity providers:
- OIDC (Keycloak, Authentik, etc.)
- OAuth2 (GitHub, Google, etc.)

### 11.3 No Age Verification

Concord does not implement mandatory age verification. That's the whole point. Instance admins in affected jurisdictions can enable it via a plugin/hook if legally required, but it is never a platform-level default.

---

## 12. PWA Strategy

### 12.1 Why PWA First

- Ships to iOS, Android, and desktop from a single codebase on day one.
- No app store review process. No 30% cut. No Apple blocking your updates.
- Service worker enables offline access to cached messages and push notifications.
- Upgradable: if a native app becomes necessary, the PWA keeps working in parallel.

### 12.2 PWA Feature Targets

| Feature | PWA Support |
|---|---|
| Push notifications | ✅ (Web Push API) |
| Offline message cache | ✅ (Service Worker + IndexedDB) |
| Background audio (voice) | ⚠️ Partial — works on Android, limited on iOS |
| Install to home screen | ✅ |
| Badge count | ✅ (Badging API, Android + desktop) |
| Camera/mic access | ✅ |
| Screenshare | ✅ Desktop only (getDisplayMedia) |

### 12.3 iOS Voice Channel Limitation

iOS Safari kills background WebRTC audio when the app is backgrounded. This is a known platform limitation and affects all PWA-based voice chat. Community reports from Matrix and Fluxer users independently confirm this is the #1 pain point for PWA-based chat apps.

Mitigations:
- Inform users when they're on iOS.
- **Phase 2 priority:** Ship a thin native iOS wrapper (WKWebView + LiveKit iOS SDK for background audio). This is not optional — it's required for voice to be usable on iOS.

---

## 13. Migration Tooling

To pull communities off Discord, we need migration tools:

- **Server structure import** — Given a Discord server export (via bot), recreate channels, categories, roles, and permissions in Concord.
- **Message history import** — Optional. Import message archives (from DiscordChatExporter or similar) into Concord as read-only archived threads.
- **Bot migration guide** — Documentation mapping Discord.js / Discord.py API calls to Concord equivalents.
- **Invite bridge** — Discord bot that posts in the old server saying "We've moved! Join us at concord.example/invite/xyz" with periodic reminders.

---

## 14. Development Phases

### Phase 0 — Foundation (Weeks 1–4)
- Project scaffolding: monorepo (Turborepo), linting, CI/CD.
- PostgreSQL schema + migrations (Drizzle ORM).
- Auth system (registration, login, JWT sessions).
- Basic REST API for users, servers, channels, messages.
- WebSocket gateway: connection, heartbeat, identify, basic events.
- React app shell: login, server list, channel list, message view.

### Phase 1 — Chat MVP (Weeks 5–10)
- Full message CRUD with real-time sync.
- Markdown rendering (GFM subset).
- File uploads (images, attachments) via MinIO.
- Threads.
- Roles and permissions (full bitmask system).
- Invite system.
- Typing indicators, presence, unread tracking.
- PWA manifest + service worker for installability.

### Phase 2 — Voice & Moderation (Weeks 11–16)
- LiveKit integration: voice channels, join/leave, mute/deafen.
- Screensharing.
- Video chat.
- Moderation tools: ban, kick, mute, slowmode, audit log.
- Built-in automod rules engine.
- Push notifications (Web Push).
- Native iOS wrapper (WKWebView + LiveKit iOS SDK) for background voice audio.

### Phase 3 — Polish & Scale (Weeks 17–22)
- Performance optimization for large servers (lazy member loading, message pagination, connection sharding).
- Bot API + webhook system.
- Custom emoji.
- User settings and notification preferences.
- Docker Compose hardening for self-hosting.
- Railway deployment config (Dockerfiles, railway.toml, managed Postgres/Redis).
- Documentation: self-hosting guide, API docs, bot development guide.

### Phase 4 — Ecosystem (Weeks 23+)
- Discord API compatibility shim.
- Migration tooling.
- E2EE for DMs (Signal protocol / MLS).
- TTL-ed messages.
- Plugin system.
- Knowledge base / wiki-lite feature (structured pinned docs per channel/server).
- Full native mobile apps (React Native or Expo, sharing web components) — iOS wrapper from Phase 2 becomes the foundation.

---

## 15. Tech Stack Summary

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | React + Vite + TypeScript | SPA for chat, fast HMR, PWA-first |
| **State management** | Zustand | Lightweight, no boilerplate |
| **Styling** | Tailwind CSS | Rapid UI development, easy theming |
| **Backend API** | Node.js + Fastify + TypeScript | Fast HTTP framework, shared language with frontend |
| **WebSocket** | `ws` (via Fastify plugin) | Raw performance, no Socket.io overhead |
| **ORM** | Drizzle | Type-safe, lightweight, SQL-first |
| **Database** | PostgreSQL 17 | Relational data, JSONB, partitioning |
| **Cache / Pub-Sub** | Redis 7 | Presence, fan-out, rate limiting |
| **Voice / Video** | LiveKit | Open-source SFU, native screenshare |
| **Containerization** | Docker + Docker Compose | Single-command self-hosted deployment |
| **Managed deploy** | Railway | WebSocket support, long-running processes, Docker-native |
| **File Storage (managed)** | Cloudflare R2 | S3-compatible, free egress |
| **File Storage (self-hosted)** | MinIO | S3-compatible, self-hostable |
| **Monorepo** | Turborepo | Shared types, coordinated builds |
| **CI/CD** | GitHub Actions | Standard, free for open source |
| **ID Generation** | Custom Snowflake | Time-sortable, distributed, no coordination |

---

## 16. Resolved Decisions (formerly Open Questions)

### 16.1 Naming

**Decision: Concord.**

- **Name:** Concord — literally means "agreement, harmony." The direct antithesis of Discord.
- **Logo:** A stylized Concord grape. Playful, recognizable, not corporate.
- **Brand palette:** Modern purple. Deliberately close to Discord's purple — this isn't a coincidence, it's a migration signal. Users see purple chat app and their brain says "this is familiar." Differentiate through a warmer, richer grape-purple rather than Discord's blurple.
- **Domain:** TBD — check availability across `.chat`, `.app`, `.dev`, `.io`. Fallbacks: `concordchat`, `getconcord`, `useconcord`.

The name works on multiple levels: it's the anti-Discord, it gives you the grape → purple branding for free, and "Concord" as a word implies community consensus — which is the whole point of the platform.

### 16.2 Federation

**Decision: No. Not in v1, not on the roadmap.**

Federation is how Matrix burned 10 years and still can't get voice chat working. Every federation feature adds an N×M compatibility surface. Concord is a self-hosted platform, not a protocol. Communities that want to talk to each other can share invite links.

If federation becomes necessary in the future, it should be built as a plugin on top of a stable single-instance platform, not baked into the core from the start.

### 16.3 Monetization

**Decision: GitLab model — open core, paid hosted tier.**

- Self-hosted Concord is fully featured, no artificial limits, no phoning home. Period.
- Revenue comes from an optional managed hosting tier (concord.cloud or similar, Railway-based) where we run the infrastructure and charge monthly per-server.
- GitHub Sponsors / Open Collective for individual donations.
- No CLA. The AGPL license means anyone running a modified version as a service must share their changes. This is the monetization protection — not legal ownership of contributions.
- Support contracts for large deployments can come later once there's traction.

This is the model that built GitLab, Plausible, and Umami. It works.

### 16.4 Discord TOS / Migration Risk

**Decision: Import from user-exported data only. No live API interaction.**

- Migration tools consume exports from DiscordChatExporter and Discord's own data export (GDPR request).
- Concord never touches Discord's API directly.
- The "invite bridge" bot that posts migration notices in old Discord servers is a separate community tool, not part of Concord's codebase, and runs under a user's own Discord bot token at their own risk.

### 16.5 Governance

**Decision: Start as a solo project with clear anti-rugpull commitments. Formalize governance at traction.**

- AGPL-3.0, no CLA, from day one. This is irrevocable — contributions can never be relicensed.
- A `GOVERNANCE.md` in the repo states: the project will never add a CLA, will never dual-license contributions, and will transition to a foundation model if/when there are 3+ sustained core contributors.
- Benevolent dictator model is fine for now. The license protects the community regardless of governance structure.

### 16.6 NSFW Policy

**Decision: Instance-level choice. Platform is agnostic.**

- Concord is infrastructure, not a hosted service. The software itself has no opinion on NSFW content.
- Channels have an `nsfw` boolean flag. When enabled, content is gated behind a confirmation ("This channel may contain NSFW content. Continue?").
- Instance admins can disable NSFW channels entirely via server settings.
- If/when a managed hosted tier exists, that tier will have its own content policy — but that's a business policy, not a software limitation.

### 16.7 Knowledge Persistence Model

**Decision: Phase 1 ships enhanced pinned messages. Phase 4 explores wiki pages.**

The community demand is real (155+ upvotes), but building a full forum/wiki system alongside a chat platform is scope creep. Incremental approach:

- **Phase 1:** Pinned messages get a dedicated "Pins" sidebar panel per channel. Pins can be categorized with tags. Search works across pins.
- **Phase 3:** "Announcements" channel type that supports longer-form posts with comments (not full threading — just top-level posts with replies). Think Discord's Forum channels.
- **Phase 4 / Backlog:** Dedicated wiki/docs pages per server. Markdown-based, versioned, with role-based edit permissions. This is a substantial feature and should be validated with real users before building.

---

## 17. Agent Team Development Notes

This project will be built primarily by AI coding agents (Claude Code and similar). The architecture and codebase conventions are designed with that in mind.

### 17.1 Repo Structure

```
concord/
├── apps/
│   ├── web/                 # React + Vite PWA
│   │   ├── src/
│   │   │   ├── components/  # UI components (one file per component)
│   │   │   ├── hooks/       # Custom React hooks
│   │   │   ├── stores/      # Zustand stores
│   │   │   ├── api/         # API client + types
│   │   │   ├── pages/       # Top-level route pages
│   │   │   └── utils/       # Pure helper functions
│   │   └── public/          # PWA manifest, icons
│   └── api/                 # Fastify backend
│       ├── src/
│       │   ├── routes/      # One file per resource (users, channels, messages, etc.)
│       │   ├── gateway/     # WebSocket gateway logic
│       │   ├── services/    # Business logic layer
│       │   ├── models/      # Drizzle schema definitions
│       │   ├── middleware/   # Auth, rate limiting, validation
│       │   └── utils/       # Snowflake gen, permissions, helpers
│       └── migrations/      # Drizzle migrations
├── packages/
│   ├── shared/              # Shared types, constants, permission utils
│   │   ├── types/           # TypeScript interfaces shared between apps
│   │   ├── permissions/     # Bitmask permission utilities
│   │   └── snowflake/       # Snowflake ID generator
│   └── config/              # Shared ESLint, TSConfig, Tailwind config
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   └── Dockerfile.*         # Per-service Dockerfiles
├── docs/
│   ├── ARCHITECTURE.md       # This spec, condensed
│   ├── API.md                # REST API reference
│   ├── GATEWAY.md            # WebSocket protocol reference
│   ├── SELF-HOSTING.md       # Deployment guide
│   └── CONTRIBUTING.md       # How to contribute
├── GOVERNANCE.md
├── LICENSE                   # AGPL-3.0
├── turbo.json
└── package.json
```

### 17.2 Agent-Friendly Conventions

These conventions are specifically chosen to make AI agent development more reliable:

**Small, single-purpose files.** No file should exceed ~300 lines. Agents work better when they can read an entire file in context. If a file is getting long, split it.

**Explicit types everywhere.** No `any`. No implicit returns. Every function has typed parameters and return types. The `packages/shared/types/` directory is the single source of truth for all data shapes. Agents rely on types to understand contracts between modules.

**One route per file in the API.** `routes/messages.ts` handles all `/api/v1/channels/:id/messages/*` endpoints. `routes/servers.ts` handles all `/api/v1/servers/*` endpoints. This makes it trivial for an agent to find and modify the right code.

**Service layer separation.** Routes call services, services call the database. Routes handle HTTP concerns (parsing, validation, response codes). Services handle business logic. This separation means an agent can modify business logic without touching HTTP concerns and vice versa.

**Database queries in service files, not scattered.** All Drizzle queries for a domain live in the corresponding service file. No raw SQL in routes. No ORM calls in utility functions.

**Consistent error handling.** Every service function returns `{ data, error }` tuples. No thrown exceptions for business logic errors. Agents can pattern-match on this without guessing exception types.

```typescript
// Pattern: every service function
type ServiceResult<T> = { data: T; error: null } | { data: null; error: AppError };

async function createMessage(params: CreateMessageParams): Promise<ServiceResult<Message>> {
  // validate, persist, fan out
}
```

**Test files colocated.** `routes/messages.ts` → `routes/messages.test.ts`. Agents can find and update tests without searching.

**Environment config in one place.** `apps/api/src/config.ts` reads all env vars, validates them at startup, and exports typed config. No `process.env.X` scattered through the codebase.

### 17.3 Agent Task Decomposition

The phased roadmap is already broken into agent-sized work units (each bullet point in §14 is roughly one focused task). When assigning to agents, follow this pattern:

1. **Spec the task** in a GitHub issue with: the goal, the files likely involved, the types/interfaces it should conform to, and a test case.
2. **Agent implements** against the spec, writes tests, and opens a PR.
3. **Human reviews** the PR for architectural fit, security, and UX. Merges or requests changes.
4. **Repeat.**

For complex features (WebSocket gateway, permissions system, LiveKit integration), write a focused sub-spec document in `docs/` before handing to the agent. The investment in a 1-page spec saves 5 rounds of agent revision.

### 17.4 Critical Path Dependencies

```
Phase 0 (Foundation)
  ├── Auth system ─────────────────────────┐
  ├── PostgreSQL schema + Drizzle setup ───┤
  ├── Basic REST API (CRUD) ───────────────┤
  └── WebSocket gateway (connect/identify) ┘
         │
Phase 1 (Chat MVP)                         ▼
  ├── Messages (depends on: schema, auth, gateway, REST)
  ├── Roles & Permissions (depends on: schema, auth)
  ├── Threads (depends on: messages)
  ├── File uploads (depends on: messages, MinIO)
  ├── Invites (depends on: auth, servers)
  └── PWA shell (depends on: REST API, gateway)
         │
Phase 2 (Voice & Mod)                      ▼
  ├── LiveKit integration (depends on: gateway, auth, permissions)
  ├── Moderation tools (depends on: permissions, messages)
  ├── Automod (depends on: messages, moderation)
  ├── iOS native wrapper (depends on: LiveKit integration)
  └── Push notifications (depends on: PWA shell, gateway)
```

Agents can work in parallel on items within the same phase that don't share dependencies. For example, in Phase 1: "Roles & Permissions" and "File uploads" can be developed simultaneously.

---

## 18. Competitive Landscape

Key insights from community research (Reddit r/selfhosted, February 2026):

| Competitor | Key Takeaway for Concord |
|---|---|
| **Matrix/Synapse** | Resource-hungry (3–4GB baseline), voice/video is broken across clients, E2EE causes UX nightmares at scale. BUT: one admin got 40 users running on 1GB RAM with Synapse. The problem is unpredictable scaling, not raw idling. |
| **Fluxer.app** | Most community excitement. 8c/16GB to self-host is too heavy. AGPL+CLA licensing raises rugpull concerns. No Docker self-hosting docs yet. Developer seems competent but ambitious. |
| **Stoat (Revolt)** | Broken email verification lost multiple potential users. No voice/video in self-hosted version. Low dev velocity. Community is rooting for it but losing patience. |
| **Nerimity** | Open source, Discord-like UI. Bans NSFW platform-wide (no federation). Worth studying for UI/UX patterns. |
| **Movim (XMPP)** | AGPL-3.0 without CLA — validates our licensing approach. Built on open protocol (XMPP). |
| **Rocket.Chat** | Free tier trick: cancel Starter license → Community workspace bypasses 50-user limit (limited to 5 apps, but Jitsi still works). |

**Community sentiment summary:** People are desperate to leave Discord but frustrated that 10-year-old alternatives still can't match its UX. The market is wide open for something that "just works" with one-command self-hosting.

---

## 19. Backlog (Post-v1.0 Exploration)

Items that surfaced from community research but are not in scope for the initial roadmap. These are worth tracking for future consideration.

| Item | Source | Notes |
|---|---|---|
| **Proof-of-human verification** | Community suggestion | Not CAPTCHA — a lightweight "proof of human" system for gating registrations. Could be a plugin hook rather than core feature. Useful for combating bot spam and AI scraping. |
| **Forum / long-form discussion mode** | Top community request (155+ upvotes) | Multiple comments requested traditional forum functionality alongside chat. Concord's knowledge base feature partially addresses this, but a full threaded forum mode (à la Discourse) could be a future addition. |
| **Paid/gated communities** | Community suggestion | Small payment as a quality filter. Could be implemented as a plugin/integration with Stripe or similar. Not core platform behavior. |
| **Anti-AI-scraping measures** | Community concern | Closed/authenticated communities are inherently harder to scrape, but explicit measures (rate limiting, bot detection) could be added as automod plugins. |
| **Discord API compatibility shim** | Spec Phase 4 | Translation layer mapping Discord.js/Discord.py calls to Concord API. High effort, high migration value. Needs careful scoping — full 1:1 parity is likely impossible and undesirable. |
| **NNTP/Usenet integration** | Community suggestion | Novelty suggestion but interesting: use established protocols for discussion archival. Very low priority. |
| **Multi-stream viewing** | Fluxer user report | Ability to view multiple screenshares simultaneously in a voice channel. LiveKit supports this natively — implementation is UI work. |
| **Cross-instance DMs** | Future federation prerequisite | Users on different Concord instances messaging each other. Requires federation groundwork. Explicitly deferred. |
| **Desktop audio capture in screenshare** | Community question | Discord supports this natively. Depends on browser getDisplayMedia support + LiveKit audio track mixing. Works on Chrome/Edge, not Firefox/Safari. Document the limitation. |

---

*This is a living document. Version 0.5 — February 2026.*
