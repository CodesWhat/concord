import type { FastifyInstance } from "fastify";
import {
  requireAuth,
  requireMember,
  requirePermission,
} from "../middleware/permissions.js";
import { Permissions } from "@concord/shared";
import * as banService from "../services/bans.js";
import { dispatchToServer, GatewayEvent } from "../gateway/index.js";
import { logAction, AuditAction } from "../services/audit.js";

export default async function banRoutes(app: FastifyInstance) {
  // POST /servers/:serverId/members/:memberId/kick
  app.post<{ Params: { serverId: string; memberId: string } }>(
    "/servers/:serverId/members/:memberId/kick",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { serverId: string }).serverId),
        requirePermission(Permissions.KICK_MEMBERS),
      ],
    },
    async (request, reply) => {
      const { serverId, memberId } = request.params;

      const result = await banService.kickMember(serverId, memberId, request.userId);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      dispatchToServer(serverId, GatewayEvent.MEMBER_LEAVE, {
        userId: memberId,
        serverId,
      });
      logAction(serverId, request.userId, AuditAction.MEMBER_KICK, "user", memberId);

      return reply.code(200).send(result.data);
    },
  );

  // POST /servers/:serverId/members/:memberId/ban
  app.post<{ Params: { serverId: string; memberId: string }; Body: { reason?: string } }>(
    "/servers/:serverId/members/:memberId/ban",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { serverId: string }).serverId),
        requirePermission(Permissions.BAN_MEMBERS),
      ],
    },
    async (request, reply) => {
      const { serverId, memberId } = request.params;
      const reason = request.body?.reason;

      const result = await banService.banMember(serverId, memberId, request.userId, reason);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      dispatchToServer(serverId, GatewayEvent.MEMBER_BAN, {
        userId: memberId,
        serverId,
      });
      logAction(serverId, request.userId, AuditAction.MEMBER_BAN, "user", memberId, {}, reason);

      return reply.code(200).send(result.data);
    },
  );

  // DELETE /servers/:serverId/bans/:userId
  app.delete<{ Params: { serverId: string; userId: string } }>(
    "/servers/:serverId/bans/:userId",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { serverId: string }).serverId),
        requirePermission(Permissions.BAN_MEMBERS),
      ],
    },
    async (request, reply) => {
      const { serverId, userId } = request.params;

      const result = await banService.unbanMember(serverId, userId);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      dispatchToServer(serverId, GatewayEvent.MEMBER_UNBAN, {
        userId,
        serverId,
      });
      logAction(serverId, request.userId, AuditAction.MEMBER_UNBAN, "user", userId);

      return reply.code(200).send(result.data);
    },
  );

  // GET /servers/:serverId/bans
  app.get<{ Params: { serverId: string } }>(
    "/servers/:serverId/bans",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { serverId: string }).serverId),
        requirePermission(Permissions.BAN_MEMBERS),
      ],
    },
    async (request, reply) => {
      const { serverId } = request.params;

      const result = await banService.getBans(serverId);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      return result.data;
    },
  );
}
