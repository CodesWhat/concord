import { eq, and, count, sql } from "drizzle-orm";
import { db } from "../db.js";
import { invites, servers, serverMembers } from "../models/schema.js";
import type { ServiceResult } from "@concord/shared";
import * as crypto from "node:crypto";

function generateCode(): string {
  return crypto.randomBytes(6).toString("base64url").slice(0, 8);
}

export async function createInvite(
  serverId: string,
  channelId: string | null,
  creatorId: string,
  maxUses?: number,
  expiresAt?: Date,
): Promise<ServiceResult<typeof invites.$inferSelect>> {
  const code = generateCode();

  const [invite] = await db
    .insert(invites)
    .values({
      code,
      serverId,
      channelId,
      creatorId,
      maxUses: maxUses ?? null,
      expiresAt: expiresAt ?? null,
    })
    .returning();

  if (!invite) {
    return { data: null, error: { code: "INTERNAL", message: "Failed to create invite", statusCode: 500 } };
  }

  return { data: invite, error: null };
}

export async function getInvite(
  code: string,
): Promise<ServiceResult<{
  code: string;
  server: { id: string; name: string; iconUrl: string | null; memberCount: number };
  expiresAt: Date | null;
}>> {
  const result = await db
    .select({
      code: invites.code,
      serverId: invites.serverId,
      expiresAt: invites.expiresAt,
      serverName: servers.name,
      serverIcon: servers.iconUrl,
    })
    .from(invites)
    .innerJoin(servers, eq(invites.serverId, servers.id))
    .where(eq(invites.code, code))
    .limit(1);

  if (result.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Invite not found", statusCode: 404 } };
  }

  const inv = result[0]!;

  // Check expiry
  if (inv.expiresAt && inv.expiresAt < new Date()) {
    return { data: null, error: { code: "EXPIRED", message: "Invite has expired", statusCode: 410 } };
  }

  // Get member count
  const [memberCount] = await db
    .select({ count: count() })
    .from(serverMembers)
    .where(eq(serverMembers.serverId, inv.serverId));

  return {
    data: {
      code: inv.code,
      server: {
        id: inv.serverId,
        name: inv.serverName,
        iconUrl: inv.serverIcon,
        memberCount: memberCount?.count ?? 0,
      },
      expiresAt: inv.expiresAt,
    },
    error: null,
  };
}

export async function acceptInvite(
  code: string,
  userId: string,
): Promise<ServiceResult<{ serverId: string }>> {
  const result = await db
    .select()
    .from(invites)
    .where(eq(invites.code, code))
    .limit(1);

  if (result.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Invite not found", statusCode: 404 } };
  }

  const invite = result[0]!;

  // Check expiry
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return { data: null, error: { code: "EXPIRED", message: "Invite has expired", statusCode: 410 } };
  }

  // Check max uses
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
    return { data: null, error: { code: "MAX_USES", message: "Invite has reached maximum uses", statusCode: 410 } };
  }

  // Check if already member
  const existing = await db
    .select()
    .from(serverMembers)
    .where(
      and(
        eq(serverMembers.userId, userId),
        eq(serverMembers.serverId, invite.serverId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return { data: null, error: { code: "ALREADY_MEMBER", message: "Already a member of this server", statusCode: 409 } };
  }

  // Join server and increment uses
  const { joinServer } = await import("./servers.js");
  const joinResult = await joinServer(userId, invite.serverId);
  if (joinResult.error) {
    return { data: null, error: joinResult.error };
  }

  // Increment uses
  await db
    .update(invites)
    .set({ uses: sql`${invites.uses} + 1` })
    .where(eq(invites.code, code));

  return { data: { serverId: invite.serverId }, error: null };
}

export async function deleteInvite(
  code: string,
): Promise<ServiceResult<{ deleted: true }>> {
  const result = await db
    .delete(invites)
    .where(eq(invites.code, code))
    .returning();

  if (result.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Invite not found", statusCode: 404 } };
  }

  return { data: { deleted: true }, error: null };
}
