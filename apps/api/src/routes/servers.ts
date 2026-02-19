import type { FastifyInstance } from "fastify";
import {
  requireAuth,
  requireMember,
  requirePermission,
} from "../middleware/permissions.js";
import * as serverService from "../services/servers.js";
import * as channelService from "../services/channels.js";
import { Permissions } from "@concord/shared";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { servers } from "../models/schema.js";
import { dispatchToServer, GatewayEvent } from "../gateway/index.js";

export default async function serverRoutes(app: FastifyInstance) {
  // POST / — Create server
  app.post<{ Body: { name: string; description?: string } }>(
    "/",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { name, description } = request.body;
      if (!name || name.trim().length === 0) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Server name is required", status: 400 } });
      }
      const result = await serverService.createServer(request.userId, name.trim(), description?.trim());
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return reply.code(201).send(result.data);
    },
  );

  // GET /:id — Get server
  app.get<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { id: string }).id),
      ],
    },
    async (request, reply) => {
      const result = await serverService.getServer(request.params.id);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // PATCH /:id — Update server
  app.patch<{ Params: { id: string }; Body: { name?: string; description?: string; iconUrl?: string } }>(
    "/:id",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { id: string }).id),
        requirePermission(Permissions.MANAGE_SERVER),
      ],
    },
    async (request, reply) => {
      const result = await serverService.updateServer(request.params.id, request.body);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // DELETE /:id — Delete server (owner only)
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      // Check ownership
      const server = await db
        .select({ ownerId: servers.ownerId })
        .from(servers)
        .where(eq(servers.id, request.params.id))
        .limit(1);

      if (server.length === 0) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Server not found", status: 404 } });
      }

      if (server[0]!.ownerId !== request.userId) {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Only the server owner can delete the server", status: 403 } });
      }

      const result = await serverService.deleteServer(request.params.id);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return reply.code(200).send(result.data);
    },
  );

  // GET /:id/members — List members
  app.get<{ Params: { id: string }; Querystring: { limit?: string; cursor?: string } }>(
    "/:id/members",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { id: string }).id),
      ],
    },
    async (request, reply) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
      const result = await serverService.getServerMembers(request.params.id, limit, request.query.cursor);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // DELETE /:id/members/@me — Leave server
  app.delete<{ Params: { id: string } }>(
    "/:id/members/@me",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { id: string }).id),
      ],
    },
    async (request, reply) => {
      const serverId = request.params.id;
      const result = await serverService.leaveServer(serverId, request.userId);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      dispatchToServer(serverId, GatewayEvent.MEMBER_LEAVE, {
        userId: request.userId,
        serverId,
      });
      return reply.code(204).send();
    },
  );

  // GET /:id/channels — List channels grouped by category
  app.get<{ Params: { id: string } }>(
    "/:id/channels",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { id: string }).id),
      ],
    },
    async (request, reply) => {
      const result = await channelService.getServerChannels(request.params.id);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );
}
