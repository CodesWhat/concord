import { eq, and, count, sql } from "drizzle-orm";
import { db } from "../db.js";
import {
  servers,
  categories,
  channels,
  serverMembers,
  roles,
  memberRoles,
  users,
} from "../models/schema.js";
import { Permissions } from "@concord/shared";
import type { ServiceResult } from "@concord/shared";

export async function createServer(
  ownerId: string,
  name: string,
  description?: string,
): Promise<ServiceResult<typeof servers.$inferSelect>> {
  try {
    return await db.transaction(async (tx) => {
      // Create server
      const [server] = await tx
        .insert(servers)
        .values({ name, ownerId, description })
        .returning();

      if (!server) {
        return { data: null, error: { code: "INTERNAL", message: "Failed to create server", statusCode: 500 } };
      }

      // Create default "General" category
      const [category] = await tx
        .insert(categories)
        .values({ serverId: server.id, name: "General", position: 0 })
        .returning();

      // Create default #general channel
      await tx.insert(channels).values({
        serverId: server.id,
        categoryId: category!.id,
        type: "text",
        name: "general",
        position: 0,
      });

      // Add owner as member
      await tx.insert(serverMembers).values({
        userId: ownerId,
        serverId: server.id,
      });

      // Create Admin role with ADMINISTRATOR permission
      const [adminRole] = await tx
        .insert(roles)
        .values({
          serverId: server.id,
          name: "Admin",
          color: "#EF4444",
          position: 1,
          permissions: BigInt(Permissions.ADMINISTRATOR),
          hoisted: true,
        })
        .returning();

      // Create default Member role
      const defaultPerms =
        Permissions.SEND_MESSAGES |
        Permissions.READ_MESSAGES |
        Permissions.ADD_REACTIONS |
        Permissions.CONNECT_VOICE |
        Permissions.SPEAK |
        Permissions.CREATE_INVITES;

      await tx.insert(roles).values({
        serverId: server.id,
        name: "Member",
        color: "#71717A",
        position: 0,
        permissions: BigInt(defaultPerms),
      });

      // Assign Admin role to owner
      await tx.insert(memberRoles).values({
        userId: ownerId,
        serverId: server.id,
        roleId: adminRole!.id,
      });

      return { data: server, error: null };
    });
  } catch (err) {
    return { data: null, error: { code: "INTERNAL", message: "Failed to create server", statusCode: 500 } };
  }
}

export async function getServer(
  serverId: string,
): Promise<ServiceResult<typeof servers.$inferSelect & { memberCount: number }>> {
  const result = await db
    .select({
      id: servers.id,
      name: servers.name,
      iconUrl: servers.iconUrl,
      ownerId: servers.ownerId,
      description: servers.description,
      settings: servers.settings,
      createdAt: servers.createdAt,
      memberCount: count(serverMembers.userId),
    })
    .from(servers)
    .leftJoin(serverMembers, eq(servers.id, serverMembers.serverId))
    .where(eq(servers.id, serverId))
    .groupBy(servers.id)
    .limit(1);

  if (result.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Server not found", statusCode: 404 } };
  }

  return { data: result[0]!, error: null };
}

export async function updateServer(
  serverId: string,
  updates: { name?: string; description?: string; iconUrl?: string },
): Promise<ServiceResult<typeof servers.$inferSelect>> {
  const result = await db
    .update(servers)
    .set(updates)
    .where(eq(servers.id, serverId))
    .returning();

  if (result.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Server not found", statusCode: 404 } };
  }

  return { data: result[0]!, error: null };
}

export async function deleteServer(
  serverId: string,
): Promise<ServiceResult<{ deleted: true }>> {
  try {
    await db.transaction(async (tx) => {
      // Delete in order: member_roles, server_members, messages (via channels), invites, channels, categories, roles, server
      await tx.delete(memberRoles).where(eq(memberRoles.serverId, serverId));
      await tx.delete(serverMembers).where(eq(serverMembers.serverId, serverId));

      // Get channel IDs to delete messages
      const serverChannels = await tx
        .select({ id: channels.id })
        .from(channels)
        .where(eq(channels.serverId, serverId));

      if (serverChannels.length > 0) {
        const { messages } = await import("../models/schema.js");
        for (const ch of serverChannels) {
          await tx.delete(messages).where(eq(messages.channelId, ch.id));
        }
      }

      const { invites } = await import("../models/schema.js");
      await tx.delete(invites).where(eq(invites.serverId, serverId));
      await tx.delete(channels).where(eq(channels.serverId, serverId));
      await tx.delete(categories).where(eq(categories.serverId, serverId));
      await tx.delete(roles).where(eq(roles.serverId, serverId));
      await tx.delete(servers).where(eq(servers.id, serverId));
    });
    return { data: { deleted: true }, error: null };
  } catch (err) {
    return { data: null, error: { code: "INTERNAL", message: "Failed to delete server", statusCode: 500 } };
  }
}

export async function getServerMembers(
  serverId: string,
  limit = 50,
  cursor?: string,
): Promise<ServiceResult<Array<{
  userId: string;
  nickname: string | null;
  joinedAt: Date;
  user: { username: string; displayName: string; avatarUrl: string | null; status: string };
  roles: Array<{ id: string; name: string; color: string | null; position: number }>;
}>>> {
  let query = db
    .select({
      userId: serverMembers.userId,
      nickname: serverMembers.nickname,
      joinedAt: serverMembers.joinedAt,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      status: users.status,
    })
    .from(serverMembers)
    .innerJoin(users, eq(serverMembers.userId, users.id))
    .where(
      cursor
        ? and(eq(serverMembers.serverId, serverId), sql`${serverMembers.userId} > ${cursor}`)
        : eq(serverMembers.serverId, serverId),
    )
    .orderBy(serverMembers.userId)
    .limit(limit);

  const members = await query;

  // Fetch roles for each member
  const result = await Promise.all(
    members.map(async (m) => {
      const mRoles = await db
        .select({
          id: roles.id,
          name: roles.name,
          color: roles.color,
          position: roles.position,
        })
        .from(memberRoles)
        .innerJoin(roles, eq(memberRoles.roleId, roles.id))
        .where(
          and(
            eq(memberRoles.userId, m.userId),
            eq(memberRoles.serverId, serverId),
          ),
        );

      return {
        userId: m.userId,
        nickname: m.nickname,
        joinedAt: m.joinedAt,
        user: {
          username: m.username,
          displayName: m.displayName,
          avatarUrl: m.avatarUrl,
          status: m.status,
        },
        roles: mRoles,
      };
    }),
  );

  return { data: result, error: null };
}

export async function joinServer(
  userId: string,
  serverId: string,
): Promise<ServiceResult<{ joined: true }>> {
  // Check if already a member
  const existing = await db
    .select()
    .from(serverMembers)
    .where(
      and(
        eq(serverMembers.userId, userId),
        eq(serverMembers.serverId, serverId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return { data: null, error: { code: "ALREADY_MEMBER", message: "Already a member of this server", statusCode: 409 } };
  }

  // Check server exists
  const server = await db
    .select({ id: servers.id })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (server.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Server not found", statusCode: 404 } };
  }

  // Add member
  await db.insert(serverMembers).values({ userId, serverId });

  // Assign default Member role
  const defaultRole = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.serverId, serverId), eq(roles.name, "Member")))
    .limit(1);

  if (defaultRole[0]) {
    await db.insert(memberRoles).values({
      userId,
      serverId,
      roleId: defaultRole[0].id,
    });
  }

  return { data: { joined: true }, error: null };
}
