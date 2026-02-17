import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { users, serverMembers, servers } from "../models/schema.js";
import { requireAuth } from "../middleware/permissions.js";
import { auth } from "../services/auth.js";
import { dispatchToServer, GatewayEvent } from "../gateway/index.js";

export default async function userRoutes(app: FastifyInstance) {
  // POST /sync — Create app user record matching Better Auth user.
  // Called after sign-up so the user exists in both tables.
  app.post("/sync", { preHandler: [requireAuth] }, async (request, reply) => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value) headers.append(key, String(value));
    }
    const session = await auth.api.getSession({ headers });
    if (!session) {
      return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "No session", status: 401 } });
    }

    const { id, name, email } = session.user;

    // Check if already synced
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (existing.length > 0) {
      return { synced: true };
    }

    // Create matching record with Better Auth's user ID
    await db.insert(users).values({
      id,
      username: name.toLowerCase().replace(/\s+/g, "_"),
      displayName: name,
      email,
      passwordHash: "managed-by-better-auth",
    });

    return reply.code(201).send({ synced: true });
  });

  // GET /@me — Current user profile
  app.get("/@me", { preHandler: [requireAuth] }, async (request, reply) => {
    const result = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    if (result.length === 0) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "User not found", status: 404 } });
    }

    return result[0];
  });

  // PATCH /@me — Update current user profile
  app.patch<{ Body: { displayName?: string; avatarUrl?: string; status?: string } }>(
    "/@me",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const updates: Record<string, unknown> = {};
      if (request.body.displayName !== undefined) updates.displayName = request.body.displayName.trim();
      if (request.body.avatarUrl !== undefined) updates.avatarUrl = request.body.avatarUrl;
      if (request.body.status !== undefined) {
        const validStatuses = ["online", "idle", "dnd", "offline"];
        if (!validStatuses.includes(request.body.status)) {
          return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Invalid status", status: 400 } });
        }
        updates.status = request.body.status;
      }

      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "No fields to update", status: 400 } });
      }

      await db.update(users).set(updates).where(eq(users.id, request.userId));

      // If status changed, broadcast presence update to all user's servers
      if (updates.status) {
        const memberships = await db
          .select({ serverId: serverMembers.serverId })
          .from(serverMembers)
          .where(eq(serverMembers.userId, request.userId));

        for (const m of memberships) {
          dispatchToServer(m.serverId, GatewayEvent.PRESENCE_UPDATE, {
            userId: request.userId,
            status: updates.status,
          });
        }
      }

      const [updated] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          status: users.status,
        })
        .from(users)
        .where(eq(users.id, request.userId))
        .limit(1);

      return updated;
    },
  );

  // GET /@me/servers — Get all servers the user is a member of
  app.get("/@me/servers", { preHandler: [requireAuth] }, async (request, _reply) => {
    const result = await db
      .select({
        id: servers.id,
        name: servers.name,
        iconUrl: servers.iconUrl,
        ownerId: servers.ownerId,
        description: servers.description,
        createdAt: servers.createdAt,
      })
      .from(serverMembers)
      .innerJoin(servers, eq(serverMembers.serverId, servers.id))
      .where(eq(serverMembers.userId, request.userId));

    return result;
  });
}
