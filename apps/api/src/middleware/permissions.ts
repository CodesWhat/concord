import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { serverMembers, memberRoles, roles, servers, channels, categories } from "../models/schema.js";
import { hasPermission, Permissions, resolveChannelPermissions, type PermissionOverrides } from "@concord/shared";
import { auth } from "../services/auth.js";

// Extend Fastify request to carry user info
declare module "fastify" {
  interface FastifyRequest {
    userId: string;
    memberPermissions?: number;
  }
}

// Validates Better Auth session from cookies and sets request.userId
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value) headers.append(key, String(value));
  }

  const session = await auth.api.getSession({ headers });
  if (!session) {
    reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Authentication required", status: 401 } });
    return;
  }
  // Better Auth user ID is used as userId throughout the app.
  // On sign-up, a matching record is created in the app's "users" table
  // via the POST /api/v1/users/sync endpoint.
  request.userId = session.user.id;
}

export function requireMember(getServerId: (req: FastifyRequest) => string | undefined) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const serverId = getServerId(request);
    if (!serverId) {
      reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Server ID required", status: 400 } });
      return;
    }

    const member = await db
      .select()
      .from(serverMembers)
      .where(
        and(
          eq(serverMembers.userId, request.userId),
          eq(serverMembers.serverId, serverId),
        ),
      )
      .limit(1);

    if (member.length === 0) {
      reply.code(403).send({ error: { code: "NOT_MEMBER", message: "You are not a member of this server", status: 403 } });
      return;
    }
  };
}

export async function resolvePermissions(userId: string, serverId: string): Promise<number> {
  // Check if user is server owner (bypasses all)
  const server = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (server[0]?.ownerId === userId) {
    return Permissions.ADMINISTRATOR | 0x7FFFFFFF; // all bits set
  }

  // Get all roles for this member in this server
  const userRoles = await db
    .select({ permissions: roles.permissions })
    .from(memberRoles)
    .innerJoin(roles, eq(memberRoles.roleId, roles.id))
    .where(
      and(
        eq(memberRoles.userId, userId),
        eq(memberRoles.serverId, serverId),
      ),
    );

  // OR all permissions together
  let perms = 0;
  for (const role of userRoles) {
    perms |= Number(role.permissions);
  }
  return perms;
}

export function requirePermission(permission: number) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const serverId = (request.params as Record<string, string>)["serverId"]
      ?? (request.params as Record<string, string>)["id"];

    if (!serverId) {
      reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Server ID required", status: 400 } });
      return;
    }

    const perms = await resolvePermissions(request.userId, serverId);
    request.memberPermissions = perms;

    if (!hasPermission(perms, permission)) {
      reply.code(403).send({ error: { code: "FORBIDDEN", message: "Missing required permission", status: 403 } });
      return;
    }
  };
}

// For channel-scoped routes, resolve server from channel
export async function getServerIdFromChannel(channelId: string): Promise<string | null> {
  const result = await db
    .select({ serverId: channels.serverId })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  return result[0]?.serverId ?? null;
}

export function requireChannelPermission(permission: number) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const channelId = (request.params as Record<string, string>)["channelId"]
      ?? (request.params as Record<string, string>)["id"];

    if (!channelId) {
      reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Channel ID required", status: 400 } });
      return;
    }

    // Fetch channel with overrides and categoryId
    const channelResult = await db
      .select({
        serverId: channels.serverId,
        categoryId: channels.categoryId,
        permissionOverrides: channels.permissionOverrides,
      })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (channelResult.length === 0) {
      reply.code(404).send({ error: { code: "NOT_FOUND", message: "Channel not found", status: 404 } });
      return;
    }

    const channel = channelResult[0]!;
    const serverId = channel.serverId;

    // Check membership
    const member = await db
      .select()
      .from(serverMembers)
      .where(
        and(
          eq(serverMembers.userId, request.userId),
          eq(serverMembers.serverId, serverId),
        ),
      )
      .limit(1);

    if (member.length === 0) {
      reply.code(403).send({ error: { code: "NOT_MEMBER", message: "You are not a member of this server", status: 403 } });
      return;
    }

    // Get base server-level permissions
    const basePerms = await resolvePermissions(request.userId, serverId);

    // If admin, skip override resolution
    if (hasPermission(basePerms, Permissions.ADMINISTRATOR)) {
      request.memberPermissions = basePerms;
      if (!hasPermission(basePerms, permission)) {
        reply.code(403).send({ error: { code: "FORBIDDEN", message: "Missing required permission", status: 403 } });
        return;
      }
      return;
    }

    // Get member's role IDs for override resolution
    const userRoleRows = await db
      .select({ roleId: memberRoles.roleId })
      .from(memberRoles)
      .where(and(eq(memberRoles.userId, request.userId), eq(memberRoles.serverId, serverId)));

    const memberRoleIds = userRoleRows.map((r) => r.roleId);

    // Fetch category overrides if channel belongs to a category
    let categoryOverrides: PermissionOverrides | null = null;
    if (channel.categoryId) {
      const catResult = await db
        .select({ permissionOverrides: categories.permissionOverrides })
        .from(categories)
        .where(eq(categories.id, channel.categoryId))
        .limit(1);

      if (catResult.length > 0) {
        categoryOverrides = catResult[0]!.permissionOverrides as PermissionOverrides;
      }
    }

    const channelOverrides = channel.permissionOverrides as PermissionOverrides;

    // Resolve effective permissions with overrides
    const effectivePerms = resolveChannelPermissions(
      basePerms,
      memberRoleIds,
      categoryOverrides,
      channelOverrides,
    );

    request.memberPermissions = effectivePerms;

    if (!hasPermission(effectivePerms, permission)) {
      reply.code(403).send({ error: { code: "FORBIDDEN", message: "Missing required permission", status: 403 } });
      return;
    }
  };
}
