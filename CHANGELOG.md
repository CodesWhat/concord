# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Kick/ban members with role hierarchy enforcement (cannot kick/ban above your own role)
- Leave server functionality with transaction safety
- Rate limiting via @fastify/rate-limit — global defaults and per-route overrides
- Slowmode enforcement on messages — configurable per channel, enforced server-side
- Password reset flow — forgot-password and reset-password pages with token-based email links
- Configurable SMTP for email delivery via nodemailer (SMTP_HOST/PORT/USER/PASS/FROM)
- Auto-migration on API startup — Drizzle migrator runs automatically, no manual DB setup
- Bans table and migration
- User profiles — bio field, GET /users/:userId, avatar upload to S3
- Forum frontend — post list, detail view, voting, comments
- Forum backend — posts, voting, comments, gateway events (FORUM_POST_CREATE, FORUM_VOTE, FORUM_COMMENT_CREATE)
- Push notifications for @mentions via Web Push API (VAPID keys configurable)
- Member context menu with kick/ban actions
- Server settings bans tab with unban capability
- Leave server button in server settings
- MEMBER_BAN and MEMBER_LEAVE gateway events broadcast to server members
- CODE_OF_CONDUCT.md and CONTRIBUTING.md for public launch

### Fixed

- Password reset API path corrected from /forget-password to /request-password-reset
- Leave server operation wrapped in transaction for atomicity
- Rate limit keyGenerator safe-cast for pre-auth requests (avoids crash on missing session)
- Ban dialog cancel buttons now close only the dialog, not the entire context menu
- Null-safe ban.user access in server settings bans tab
- Missing communities/subscriptions model exports (commented out, deferred to Phase 2)
- Forum routes now have explicit per-route rate limits
- Server members endpoint limit clamped to 1–200 to prevent unbounded queries
- Display name length validation on profile update
- Password reset tokens no longer logged in production environments
- Removed dead middleware/auth.ts file

### Changed

- Deployment config: CORS origins, auth URLs, and secrets now fully env-driven
- .env.example updated to reflect current variable names

## [0.2.0] - 2026-02-17

### Added

- Gateway event handlers for MESSAGE_UPDATE, MESSAGE_DELETE, PRESENCE_UPDATE, TYPING_START
- Presence store (Zustand) tracking live user statuses with real-time gateway updates
- Typing store with per-channel tracking and 8-second auto-expire timers
- Message edit/delete UI: inline editing (Enter/Escape), delete confirmation, "(edited)" tag
- Markdown rendering with react-markdown + remark-gfm (code blocks, links, lists, tables, task lists)
- Live presence wired to MemberSidebar (overrides stale fetch data with gateway events)
- Typing indicator bar with animated dots and natural language ("X is typing...", "X and Y are typing...")
- Throttled typing event dispatch from MessageInput (5-second debounce)
- POST /channels/:channelId/typing API endpoint with gateway broadcast
- PATCH /users/@me API endpoint for profile updates (displayName, avatarUrl, status)
- Status selector dropdown in ChannelSidebar user panel (Online, Idle, DND, Invisible)
- Invite modal: generate links with configurable expiry, copy to clipboard
- Join server page at /invite/:code with auth-aware accept flow
- Server settings modal: edit name/description, delete server (owner-only), manage channels
- Channel creation form in server settings (text/voice/announcement types)
- Cmd+K quick switcher with fuzzy search across servers and channels
- Keyboard navigation in quick switcher (arrow keys, Enter, Escape)

## [0.1.0] - 2026-02-17

### Added

- Project specification with full architecture, data model, and phased roadmap
- Forum channel type in spec for Phase 2 (Reddit replacement feature)
- Brand assets: low-poly grape logo, favicons, PWA manifest
- Tailwind CSS v4 design system with grape-purple theme and three-tier dark backgrounds
- UI primitives: Button (4 variants), Input (with password toggle), Avatar, Badge
- Custom icon set (Lucide-based) for chat interface
- Auth pages: login with email/password, register with password strength indicator
- Better Auth integration (server + client) with Drizzle adapter
- Auth store (Zustand) with session management and user sync
- Full chat interface: ServerRail, ChannelSidebar, MessageList, MessageInput, MessageHeader, MemberSidebar, MobileNav
- Responsive 4-panel layout with mobile support
- PostgreSQL 17 database schema via Drizzle ORM (users, servers, channels, messages, roles, invites, categories, server members, member roles)
- Better Auth schema (sessions, accounts, verifications)
- Drizzle migrations and seed data (2 users, 1 server, 10 channels, 3 roles, 7 messages)
- Snowflake ID generator (64-bit, custom epoch 2026-01-01)
- REST API: full CRUD for servers, channels, messages, invites, users
- Permission middleware with Better Auth session validation and bitmask role checks
- User sync endpoint bridging Better Auth users to app users table
- WebSocket gateway: HELLO/IDENTIFY/READY lifecycle, heartbeat monitoring, Redis pub/sub event dispatch
- Presence tracking (online/offline broadcasts on connect/disconnect)
- Frontend API client with typed fetch wrapper and session cookie support
- WebSocket client with auto-reconnect and exponential backoff
- Zustand stores for servers, channels, and messages (wired to real API)
- Vite proxy configuration for API and gateway forwarding
- Environment configuration with `.env.example`
