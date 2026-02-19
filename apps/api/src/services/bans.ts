import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { bans, serverMembers, memberRoles, servers, users } from "../models/schema.js";
import { getHighestRolePosition } from "./roles.js";
import type { ServiceResult } from "@concord/shared";

export async function banMember(
  serverId: string,
  targetUserId: string,
  bannedByUserId: string,
  reason?: string,
): Promise<ServiceResult<typeof bans.$inferSelect>> {
  // Check target is not the server owner
  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) {
    return { data: null, error: { code: "NOT_FOUND", message: "Server not found", statusCode: 404 } };
  }

  if (server.ownerId === targetUserId) {
    return { data: null, error: { code: "FORBIDDEN", message: "Cannot ban the server owner", statusCode: 403 } };
  }

  // Check role hierarchy
  if (server.ownerId !== bannedByUserId) {
    const bannerHighest = await getHighestRolePosition(bannedByUserId, serverId);
    const targetHighest = await getHighestRolePosition(targetUserId, serverId);

    if (targetHighest >= bannerHighest) {
      return { data: null, error: { code: "FORBIDDEN", message: "Cannot ban a member with an equal or higher role", statusCode: 403 } };
    }
  }

  // Insert ban, delete member + member_roles in a transaction
  const [ban] = await db.transaction(async (tx) => {
    // Remove member roles
    await tx
      .delete(memberRoles)
      .where(
        and(
          eq(memberRoles.userId, targetUserId),
          eq(memberRoles.serverId, serverId),
        ),
      );

    // Remove from server members
    await tx
      .delete(serverMembers)
      .where(
        and(
          eq(serverMembers.userId, targetUserId),
          eq(serverMembers.serverId, serverId),
        ),
      );

    // Insert ban record
    return tx
      .insert(bans)
      .values({
        userId: targetUserId,
        serverId,
        reason: reason ?? null,
        bannedBy: bannedByUserId,
      })
      .onConflictDoNothing()
      .returning();
  });

  if (!ban) {
    return { data: null, error: { code: "CONFLICT", message: "User is already banned", statusCode: 409 } };
  }

  return { data: ban, error: null };
}

export async function unbanMember(
  serverId: string,
  targetUserId: string,
): Promise<ServiceResult<{ unbanned: true }>> {
  const result = await db
    .delete(bans)
    .where(
      and(
        eq(bans.userId, targetUserId),
        eq(bans.serverId, serverId),
      ),
    )
    .returning();

  if (result.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Ban not found", statusCode: 404 } };
  }

  return { data: { unbanned: true }, error: null };
}

export async function getBans(
  serverId: string,
): Promise<ServiceResult<Array<{
  userId: string;
  serverId: string;
  reason: string | null;
  bannedBy: string;
  createdAt: Date;
  user: { username: string; displayName: string; avatarUrl: string | null };
}>>> {
  const result = await db
    .select({
      userId: bans.userId,
      serverId: bans.serverId,
      reason: bans.reason,
      bannedBy: bans.bannedBy,
      createdAt: bans.createdAt,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(bans)
    .innerJoin(users, eq(bans.userId, users.id))
    .where(eq(bans.serverId, serverId));

  const mapped = result.map((r) => ({
    userId: r.userId,
    serverId: r.serverId,
    reason: r.reason,
    bannedBy: r.bannedBy,
    createdAt: r.createdAt,
    user: {
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    },
  }));

  return { data: mapped, error: null };
}

export async function isBanned(
  serverId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .select({ userId: bans.userId })
    .from(bans)
    .where(
      and(
        eq(bans.userId, userId),
        eq(bans.serverId, serverId),
      ),
    )
    .limit(1);

  return result.length > 0;
}

export async function kickMember(
  serverId: string,
  targetUserId: string,
  kickedByUserId: string,
): Promise<ServiceResult<{ kicked: true }>> {
  // Check target is not the server owner
  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) {
    return { data: null, error: { code: "NOT_FOUND", message: "Server not found", statusCode: 404 } };
  }

  if (server.ownerId === targetUserId) {
    return { data: null, error: { code: "FORBIDDEN", message: "Cannot kick the server owner", statusCode: 403 } };
  }

  // Check role hierarchy
  if (server.ownerId !== kickedByUserId) {
    const kickerHighest = await getHighestRolePosition(kickedByUserId, serverId);
    const targetHighest = await getHighestRolePosition(targetUserId, serverId);

    if (targetHighest >= kickerHighest) {
      return { data: null, error: { code: "FORBIDDEN", message: "Cannot kick a member with an equal or higher role", statusCode: 403 } };
    }
  }

  // Remove member + member_roles in a transaction
  await db.transaction(async (tx) => {
    await tx
      .delete(memberRoles)
      .where(
        and(
          eq(memberRoles.userId, targetUserId),
          eq(memberRoles.serverId, serverId),
        ),
      );

    await tx
      .delete(serverMembers)
      .where(
        and(
          eq(serverMembers.userId, targetUserId),
          eq(serverMembers.serverId, serverId),
        ),
      );
  });

  return { data: { kicked: true }, error: null };
}
