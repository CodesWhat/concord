import { db } from "./db.js";
import { sql } from "drizzle-orm";
import * as schema from "./models/schema.js";
import { hash } from "@node-rs/argon2";
import crypto from "node:crypto";

function generateId(): string {
  return crypto.randomBytes(16).toString("base64url");
}

/**
 * Auto-seed sample data on first boot if the users table is empty.
 * Returns true if seed was applied, false if skipped.
 */
export async function autoSeed(): Promise<boolean> {
  const result = await db.execute(sql`SELECT count(*)::int AS c FROM users`);
  const count = (result as any[])?.[0]?.c ?? (result as any).rows?.[0]?.c ?? 1;
  if (count > 0) return false;

  console.log("[auto-seed] No users found, seeding sample data...");

  const passwordHash = await hash("password123");

  // --- Users ---
  const [admin, testuser] = await db
    .insert(schema.users)
    .values([
      {
        id: generateId(),
        username: "admin",
        email: "admin@concord.local",
        displayName: "Admin",
        passwordHash,
      },
      {
        id: generateId(),
        username: "testuser",
        email: "test@concord.local",
        displayName: "Test User",
        passwordHash,
      },
    ])
    .returning();

  // --- Server ---
  const [server] = await db
    .insert(schema.servers)
    .values({ name: "Concord Community", ownerId: admin!.id })
    .returning();

  // --- Categories ---
  const [catGeneral, catDev, catVoice] = await db
    .insert(schema.categories)
    .values([
      { serverId: server!.id, name: "General", position: 0 },
      { serverId: server!.id, name: "Development", position: 1 },
      { serverId: server!.id, name: "Voice", position: 2 },
    ])
    .returning();

  // --- Channels ---
  const channelsData = await db
    .insert(schema.channels)
    .values([
      { serverId: server!.id, categoryId: catGeneral!.id, type: "text" as const, name: "welcome", position: 0 },
      { serverId: server!.id, categoryId: catGeneral!.id, type: "text" as const, name: "rules", position: 1 },
      { serverId: server!.id, categoryId: catGeneral!.id, type: "text" as const, name: "general", position: 2 },
      { serverId: server!.id, categoryId: catGeneral!.id, type: "text" as const, name: "introductions", position: 3 },
      { serverId: server!.id, categoryId: catDev!.id, type: "text" as const, name: "dev", position: 0 },
      { serverId: server!.id, categoryId: catDev!.id, type: "text" as const, name: "design", position: 1 },
      { serverId: server!.id, categoryId: catDev!.id, type: "text" as const, name: "testing", position: 2 },
      { serverId: server!.id, categoryId: catDev!.id, type: "text" as const, name: "help", position: 3 },
      { serverId: server!.id, categoryId: catVoice!.id, type: "voice" as const, name: "Lounge", position: 0 },
      { serverId: server!.id, categoryId: catVoice!.id, type: "voice" as const, name: "Gaming", position: 1 },
    ])
    .returning();

  const generalChannel = channelsData.find((c) => c.name === "general")!;

  // --- Roles ---
  const SEND_MESSAGES = 1n << 0n;
  const READ_MESSAGES = 1n << 1n;
  const MANAGE_MESSAGES = 1n << 2n;
  const ADD_REACTIONS = 1n << 5n;
  const CONNECT_VOICE = 1n << 10n;
  const SPEAK = 1n << 11n;
  const KICK_MEMBERS = 1n << 20n;
  const BAN_MEMBERS = 1n << 21n;
  const MUTE_MEMBERS = 1n << 22n;
  const MANAGE_THREADS = 1n << 25n;
  const CREATE_INVITES = 1n << 26n;
  const ADMINISTRATOR = 1n << 30n;

  const [adminRole, , memberRole] = await db
    .insert(schema.roles)
    .values([
      {
        serverId: server!.id,
        name: "Admin",
        color: "#EF4444",
        position: 2,
        permissions: ADMINISTRATOR,
        hoisted: true,
      },
      {
        serverId: server!.id,
        name: "Moderator",
        color: "#3B82F6",
        position: 1,
        permissions: MANAGE_MESSAGES | KICK_MEMBERS | BAN_MEMBERS | MUTE_MEMBERS | MANAGE_THREADS,
        hoisted: true,
      },
      {
        serverId: server!.id,
        name: "Member",
        color: "#71717A",
        position: 0,
        permissions: SEND_MESSAGES | READ_MESSAGES | ADD_REACTIONS | CONNECT_VOICE | SPEAK | CREATE_INVITES,
      },
    ])
    .returning();

  // --- Server Members ---
  await db.insert(schema.serverMembers).values([
    { userId: admin!.id, serverId: server!.id },
    { userId: testuser!.id, serverId: server!.id },
  ]);

  // --- Member Roles ---
  await db.insert(schema.memberRoles).values([
    { userId: admin!.id, serverId: server!.id, roleId: adminRole!.id },
    { userId: testuser!.id, serverId: server!.id, roleId: memberRole!.id },
  ]);

  // --- Seed Messages ---
  const now = Date.now();
  await db.insert(schema.messages).values([
    {
      id: BigInt(now - 6000),
      channelId: generalChannel.id,
      authorId: admin!.id,
      content: "Welcome to Concord Community! This is the official server.",
    },
    {
      id: BigInt(now - 5000),
      channelId: generalChannel.id,
      authorId: testuser!.id,
      content: "Hey everyone! Excited to be here.",
    },
    {
      id: BigInt(now - 4000),
      channelId: generalChannel.id,
      authorId: admin!.id,
      content: "Feel free to check out the different channels. #dev is great for development discussion.",
    },
    {
      id: BigInt(now - 3000),
      channelId: generalChannel.id,
      authorId: testuser!.id,
      content: "The voice channels look cool too. Anyone want to hop in Lounge?",
    },
    {
      id: BigInt(now - 2000),
      channelId: generalChannel.id,
      authorId: admin!.id,
      content: "Sure! Let me finish up a few things first.",
    },
    {
      id: BigInt(now - 1000),
      channelId: generalChannel.id,
      authorId: testuser!.id,
      content: "No rush. I'll be around. This platform is looking great so far!",
    },
    {
      id: BigInt(now),
      channelId: generalChannel.id,
      authorId: admin!.id,
      content: "Thanks! We're still building it out. Stay tuned for more features.",
    },
  ]);

  console.log("[auto-seed] Seed complete — admin@concord.local / password123");
  return true;
}
