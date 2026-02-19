import type { FastifyInstance } from "fastify";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db.js";
import { channels, categories, servers, memberRoles } from "../models/schema.js";
import { requireAuth, requireMember, resolvePermissions } from "../middleware/permissions.js";
import { hasPermission, Permissions, resolveChannelPermissions, type PermissionOverrides } from "@concord/shared";
import * as searchService from "../services/search.js";

async function getVisibleChannelIds(userId: string, serverId: string): Promise<string[]> {
  // Get all channels in the server
  const serverChannels = await db
    .select({
      id: channels.id,
      categoryId: channels.categoryId,
      permissionOverrides: channels.permissionOverrides,
    })
    .from(channels)
    .where(eq(channels.serverId, serverId));

  // Check if user is server owner (sees all)
  const server = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (server[0]?.ownerId === userId) {
    return serverChannels.map((c) => c.id);
  }

  // Get base permissions
  const basePerms = await resolvePermissions(userId, serverId);
  if (hasPermission(basePerms, Permissions.ADMINISTRATOR)) {
    return serverChannels.map((c) => c.id);
  }

  // Get member's role IDs
  const userRoleRows = await db
    .select({ roleId: memberRoles.roleId })
    .from(memberRoles)
    .where(and(eq(memberRoles.userId, userId), eq(memberRoles.serverId, serverId)));
  const memberRoleIds = userRoleRows.map((r) => r.roleId);

  // Fetch all category overrides in one query
  const categoryIds = [
    ...new Set(serverChannels.map((c) => c.categoryId).filter(Boolean)),
  ] as string[];
  const categoryMap = new Map<string, unknown>();
  if (categoryIds.length > 0) {
    const catRows = await db
      .select({ id: categories.id, permissionOverrides: categories.permissionOverrides })
      .from(categories)
      .where(inArray(categories.id, categoryIds));
    for (const c of catRows) {
      categoryMap.set(c.id, c.permissionOverrides);
    }
  }

  // Filter channels by READ_MESSAGES permission
  const visible: string[] = [];
  for (const ch of serverChannels) {
    const catOverrides = ch.categoryId
      ? (categoryMap.get(ch.categoryId) as PermissionOverrides | null)
      : null;
    const chOverrides = ch.permissionOverrides as PermissionOverrides;
    const effectivePerms = resolveChannelPermissions(
      basePerms,
      memberRoleIds,
      catOverrides ?? null,
      chOverrides,
    );
    if (hasPermission(effectivePerms, Permissions.READ_MESSAGES)) {
      visible.push(ch.id);
    }
  }
  return visible;
}

export default async function searchRoutes(app: FastifyInstance) {
  // GET /servers/:serverId/search — Search messages in a server
  app.get<{
    Params: { serverId: string };
    Querystring: {
      q: string;
      channelId?: string;
      authorId?: string;
      before?: string;
      after?: string;
      limit?: string;
    };
  }>(
    "/servers/:serverId/search",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { serverId: string }).serverId),
      ],
    },
    async (request, reply) => {
      const { q, channelId, authorId, before, after, limit } = request.query;

      // Validate query
      const trimmedQuery = q?.trim();
      if (!trimmedQuery || trimmedQuery.length === 0) {
        return reply.code(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "Search query is required",
            statusCode: 400,
          },
        });
      }
      if (trimmedQuery.length > 200) {
        return reply.code(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "Search query must be 200 characters or fewer",
            statusCode: 400,
          },
        });
      }

      const safeLimit = limit ? parseInt(limit, 10) : 25;

      // Resolve which channels this user can read (respects channel/category overrides)
      const visibleChannelIds = await getVisibleChannelIds(
        request.userId,
        request.params.serverId,
      );

      const result = await searchService.searchMessages(
        request.params.serverId,
        trimmedQuery,
        {
          channelId,
          authorId,
          before,
          after,
          limit: safeLimit,
          visibleChannelIds,
        },
      );

      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      return result.data;
    },
  );
}
