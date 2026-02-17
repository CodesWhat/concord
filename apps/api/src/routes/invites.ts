import type { FastifyInstance } from "fastify";
import {
  requireAuth,
  requireMember,
  requirePermission,
} from "../middleware/permissions.js";
import * as inviteService from "../services/invites.js";
import { Permissions } from "@concord/shared";

export default async function inviteRoutes(app: FastifyInstance) {
  // POST /servers/:serverId/invites — Create invite
  app.post<{ Params: { serverId: string }; Body: { channelId?: string; maxUses?: number; expiresIn?: number } }>(
    "/servers/:serverId/invites",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { serverId: string }).serverId),
        requirePermission(Permissions.CREATE_INVITES),
      ],
    },
    async (request, reply) => {
      const { channelId, maxUses, expiresIn } = request.body;
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;

      const result = await inviteService.createInvite(
        request.params.serverId,
        channelId ?? null,
        request.userId,
        maxUses,
        expiresAt,
      );
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return reply.code(201).send(result.data);
    },
  );

  // GET /invites/:code — Get invite info (public, no auth)
  app.get<{ Params: { code: string } }>(
    "/invites/:code",
    async (request, reply) => {
      const result = await inviteService.getInvite(request.params.code);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // POST /invites/:code/accept — Accept invite
  app.post<{ Params: { code: string } }>(
    "/invites/:code/accept",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const result = await inviteService.acceptInvite(request.params.code, request.userId);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );
}
