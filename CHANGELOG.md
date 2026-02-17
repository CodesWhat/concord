# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
