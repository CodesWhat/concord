import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import path from "node:path";
import { db } from "../db.js";
import { users, serverMembers, servers } from "../models/schema.js";
import { requireAuth } from "../middleware/permissions.js";
import { auth } from "../services/auth.js";
import { dispatchToServer, GatewayEvent } from "../gateway/index.js";
import { uploadFile, getFileUrl } from "../services/s3.js";

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
        bio: users.bio,
        status: users.status,
        createdAt: users.createdAt,
        flags: users.flags,
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
  app.patch<{ Body: { displayName?: string; avatarUrl?: string; status?: string; bio?: string } }>(
    "/@me",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const updates: Record<string, unknown> = {};
      if (request.body.displayName !== undefined) {
        const trimmed = request.body.displayName.trim();
        if (trimmed.length === 0 || trimmed.length > 64) {
          return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Display name must be 1-64 characters", status: 400 } });
        }
        updates.displayName = trimmed;
      }
      if (request.body.avatarUrl !== undefined) updates.avatarUrl = request.body.avatarUrl;
      if (request.body.bio !== undefined) {
        if (request.body.bio.length > 500) {
          return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Bio must be 500 characters or fewer", status: 400 } });
        }
        updates.bio = request.body.bio;
      }
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
          bio: users.bio,
          status: users.status,
          createdAt: users.createdAt,
          flags: users.flags,
        })
        .from(users)
        .where(eq(users.id, request.userId))
        .limit(1);

      return updated;
    },
  );

  // GET /:userId — Public user profile (no email/passwordHash)
  app.get<{ Params: { userId: string } }>(
    "/:userId",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const result = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          bio: users.bio,
          status: users.status,
          createdAt: users.createdAt,
          flags: users.flags,
        })
        .from(users)
        .where(eq(users.id, request.params.userId))
        .limit(1);

      if (result.length === 0) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "User not found", status: 404 } });
      }

      return result[0];
    },
  );

  // POST /@me/avatar — Upload avatar image
  app.post(
    "/@me/avatar",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const file = await request.file();

      if (!file) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "No file provided", status: 400 } });
      }

      if (!file.mimetype.startsWith("image/")) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Only image files are allowed", status: 400 } });
      }

      const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of file.file) {
        size += chunk.length;
        if (size > MAX_AVATAR_SIZE) {
          return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "File exceeds 5 MB limit", status: 400 } });
        }
        chunks.push(chunk);
      }

      if (file.file.truncated) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "File exceeds 5 MB limit", status: 400 } });
      }

      const buffer = Buffer.concat(chunks);
      const ext = path.extname(file.filename) || ".png";
      const key = `avatars/${request.userId}${ext}`;

      await uploadFile(key, buffer, file.mimetype, buffer.length);
      const avatarUrl = await getFileUrl(key);

      await db
        .update(users)
        .set({ avatarUrl })
        .where(eq(users.id, request.userId));

      const [updated] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          bio: users.bio,
          status: users.status,
          createdAt: users.createdAt,
          flags: users.flags,
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
