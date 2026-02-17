import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { users, serverMembers, servers } from "../models/schema.js";
import { requireAuth } from "../middleware/permissions.js";
import { auth } from "../services/auth.js";

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
