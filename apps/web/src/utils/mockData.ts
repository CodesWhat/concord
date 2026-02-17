import type { UserStatus, ChannelType } from "@concord/shared";

// ── Types for mock data ─────────────────────────────────────────────

export interface MockServer {
  id: string;
  name: string;
  iconUrl: string | null;
  unreadCount: number;
  mentionCount: number;
}

export interface MockCategory {
  id: string;
  name: string;
  channels: MockChannel[];
}

export interface MockChannel {
  id: string;
  name: string;
  type: ChannelType;
  topic?: string;
  unreadCount: number;
  mentionCount: number;
  connectedUsers?: number;
}

export type MemberRole = "admin" | "moderator" | "member";

export interface MockMember {
  id: string;
  username: string;
  displayName: string;
  status: UserStatus;
  role: MemberRole;
  activity?: string;
}

export interface MockMessage {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
  isNewDivider?: boolean;
  replyTo?: { authorName: string; preview: string };
}

// ── Role colors ─────────────────────────────────────────────────────

export const ROLE_COLORS: Record<MemberRole, string> = {
  admin: "#EF4444",
  moderator: "#3B82F6",
  member: "#F5F5F7",
};

// ── Servers ─────────────────────────────────────────────────────────

export const servers: MockServer[] = [
  { id: "s1", name: "Concord Community", iconUrl: null, unreadCount: 12, mentionCount: 3 },
  { id: "s2", name: "Open Source Hub", iconUrl: null, unreadCount: 5, mentionCount: 0 },
  { id: "s3", name: "Gaming Lounge", iconUrl: null, unreadCount: 0, mentionCount: 0 },
  { id: "s4", name: "Design Studio", iconUrl: null, unreadCount: 2, mentionCount: 1 },
];

// ── Categories & Channels ───────────────────────────────────────────

export const categories: MockCategory[] = [
  {
    id: "cat1",
    name: "General",
    channels: [
      { id: "c1", name: "welcome", type: "text", topic: "Say hi!", unreadCount: 0, mentionCount: 0 },
      { id: "c2", name: "rules", type: "text", unreadCount: 0, mentionCount: 0 },
      { id: "c3", name: "general", type: "text", topic: "Hang out and chat", unreadCount: 12, mentionCount: 0 },
      { id: "c4", name: "introductions", type: "text", unreadCount: 0, mentionCount: 0 },
    ],
  },
  {
    id: "cat2",
    name: "Development",
    channels: [
      { id: "c5", name: "dev", type: "text", topic: "Development discussion", unreadCount: 0, mentionCount: 3 },
      { id: "c6", name: "design", type: "text", unreadCount: 0, mentionCount: 0 },
      { id: "c7", name: "testing", type: "text", unreadCount: 0, mentionCount: 0 },
      { id: "c8", name: "help", type: "text", unreadCount: 0, mentionCount: 0 },
    ],
  },
  {
    id: "cat3",
    name: "Voice",
    channels: [
      { id: "c9", name: "Lounge", type: "voice", unreadCount: 0, mentionCount: 0, connectedUsers: 3 },
      { id: "c10", name: "Gaming", type: "voice", unreadCount: 0, mentionCount: 0, connectedUsers: 0 },
      { id: "c11", name: "Music", type: "voice", unreadCount: 0, mentionCount: 0, connectedUsers: 0 },
    ],
  },
];

// ── Members ─────────────────────────────────────────────────────────

export const members: MockMember[] = [
  { id: "u1", username: "nova", displayName: "Nova", status: "online", role: "admin", activity: "Working on Concord" },
  { id: "u2", username: "kai", displayName: "Kai", status: "online", role: "moderator" },
  { id: "u3", username: "luna_dev", displayName: "Luna", status: "online", role: "member", activity: "Playing Valorant" },
  { id: "u4", username: "orion", displayName: "Orion", status: "online", role: "member" },
  { id: "u5", username: "ember", displayName: "Ember", status: "idle", role: "member", activity: "Listening to Spotify" },
  { id: "u6", username: "cass", displayName: "Cass", status: "online", role: "moderator" },
  { id: "u7", username: "pixel", displayName: "Pixel", status: "online", role: "member" },
  { id: "u8", username: "sage", displayName: "Sage", status: "dnd", role: "member", activity: "In a meeting" },
  { id: "u9", username: "river", displayName: "River", status: "online", role: "member" },
  { id: "u10", username: "atlas", displayName: "Atlas", status: "online", role: "member" },
  { id: "u11", username: "maple", displayName: "Maple", status: "online", role: "member" },
  { id: "u12", username: "zen", displayName: "Zen", status: "idle", role: "member" },
  { id: "u13", username: "frost", displayName: "Frost", status: "offline", role: "member" },
  { id: "u14", username: "blaze", displayName: "Blaze", status: "offline", role: "member" },
  { id: "u15", username: "echo", displayName: "Echo", status: "offline", role: "member" },
  { id: "u16", username: "dusk", displayName: "Dusk", status: "offline", role: "member" },
  { id: "u17", username: "ivy", displayName: "Ivy", status: "offline", role: "admin" },
  { id: "u18", username: "reef", displayName: "Reef", status: "offline", role: "member" },
  { id: "u19", username: "storm", displayName: "Storm", status: "offline", role: "moderator" },
  { id: "u20", username: "wren", displayName: "Wren", status: "offline", role: "member" },
];

// ── Helper ──────────────────────────────────────────────────────────

function todayAt(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// ── Messages ────────────────────────────────────────────────────────

export const messages: MockMessage[] = [
  { id: "m1", authorId: "u1", content: "Hey everyone! Welcome to the new Concord community server. Excited to have you all here.", createdAt: todayAt(9, 0) },
  { id: "m2", authorId: "u2", content: "Looking great so far! The new design is really clean.", createdAt: todayAt(9, 5) },
  { id: "m3", authorId: "u3", content: "Just joined, this is awesome!", createdAt: todayAt(9, 12) },
  { id: "m4", authorId: "u3", content: "Is there a roadmap for upcoming features?", createdAt: todayAt(9, 13) },
  { id: "m5", authorId: "u1", content: "Yes! We're working on voice channels, threads, and a plugin system. Check #dev for more details.", createdAt: todayAt(9, 18) },
  { id: "m6", authorId: "u4", content: "The **plugin system** sounds incredible. Will there be an SDK?", createdAt: todayAt(9, 25) },
  { id: "m7", authorId: "u5", content: "Anyone else having issues with dark mode flickering on page load?", createdAt: todayAt(9, 40) },
  { id: "m8", authorId: "u6", content: "That's a known issue, we're patching it today.", createdAt: todayAt(9, 42) },
  { id: "m9", authorId: "u7", content: "Here's a quick fix if anyone needs it:", createdAt: todayAt(9, 50) },
  { id: "m10", authorId: "u7", content: "```typescript\n// Add to your root layout\ndocument.documentElement.classList.add('dark');\n```", createdAt: todayAt(9, 51) },
  { id: "m11", authorId: "u1", content: "Nice catch, Pixel! We'll add that to the docs.", createdAt: todayAt(10, 0), isNewDivider: true },
  { id: "m12", authorId: "u9", content: "Just pushed a PR for the notification system. Would love some reviews!", createdAt: todayAt(10, 15) },
  { id: "m13", authorId: "u2", content: "I'll take a look after lunch.", createdAt: todayAt(10, 20) },
  { id: "m14", authorId: "u10", content: "The *real-time sync* is buttery smooth. Great job on the WebSocket layer.", createdAt: todayAt(10, 30) },
  { id: "m15", authorId: "u8", content: "Quick question: are we using Zustand or Redux for client state?", createdAt: todayAt(10, 45) },
  { id: "m16", authorId: "u1", content: "Zustand for sure. Lighter weight and pairs well with our architecture.", createdAt: todayAt(10, 47) },
  { id: "m17", authorId: "u1", content: "We might add Immer middleware for complex nested updates though.", createdAt: todayAt(10, 48) },
  { id: "m18", authorId: "u11", content: "Love this community already. Glad to be here!", createdAt: todayAt(11, 0) },
];

// ── Current user (for the bottom panel) ─────────────────────────────

export const currentUser: MockMember = {
  id: "u1",
  username: "nova",
  displayName: "Nova",
  status: "online",
  role: "admin",
};

// ── Helpers ─────────────────────────────────────────────────────────

export function getMemberById(id: string): MockMember | undefined {
  return members.find((m) => m.id === id);
}

export function getOnlineMembers(): MockMember[] {
  return members.filter((m) => m.status !== "offline");
}

export function getOfflineMembers(): MockMember[] {
  return members.filter((m) => m.status === "offline");
}
