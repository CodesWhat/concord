import type { FastifyInstance } from "fastify";
import {
  requireAuth,
  requireChannelPermission,
  resolvePermissions,
  getServerIdFromChannel,
} from "../middleware/permissions.js";
import * as messageService from "../services/messages.js";
import { Permissions } from "@concord/shared";
import { dispatchToChannel, GatewayEvent } from "../gateway/index.js";

export default async function messageRoutes(app: FastifyInstance) {
  // POST /channels/:channelId/messages — Send message
  app.post<{ Params: { channelId: string }; Body: { content: string; replyToId?: string } }>(
    "/channels/:channelId/messages",
    {
      preHandler: [
        requireAuth,
        requireChannelPermission(Permissions.SEND_MESSAGES),
      ],
    },
    async (request, reply) => {
      const { content, replyToId } = request.body;
      if (!content || content.trim().length === 0) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Message content is required", status: 400 } });
      }
      if (content.length > 4000) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Message content too long (max 4000 characters)", status: 400 } });
      }
      const result = await messageService.createMessage(
        request.params.channelId,
        request.userId,
        content,
        replyToId,
      );
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      const msg = result.data!;

      // Dispatch MESSAGE_CREATE to channel members via gateway
      const serverId = await getServerIdFromChannel(request.params.channelId);
      if (serverId) {
        dispatchToChannel(serverId, GatewayEvent.MESSAGE_CREATE, msg);
      }

      return reply.code(201).send(msg);
    },
  );

  // GET /channels/:channelId/messages — Get messages
  app.get<{ Params: { channelId: string }; Querystring: { before?: string; limit?: string } }>(
    "/channels/:channelId/messages",
    {
      preHandler: [
        requireAuth,
        requireChannelPermission(Permissions.READ_MESSAGES),
      ],
    },
    async (request, reply) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
      const result = await messageService.getMessages(
        request.params.channelId,
        request.query.before,
        limit,
      );
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // PATCH /channels/:channelId/messages/:id — Edit message
  app.patch<{ Params: { channelId: string; id: string }; Body: { content: string } }>(
    "/channels/:channelId/messages/:id",
    {
      preHandler: [
        requireAuth,
        requireChannelPermission(Permissions.SEND_MESSAGES),
      ],
    },
    async (request, reply) => {
      const { content } = request.body;
      if (!content || content.trim().length === 0) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Message content is required", status: 400 } });
      }
      const result = await messageService.updateMessage(request.params.id, request.userId, content);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      const msg = result.data!;

      // Dispatch MESSAGE_UPDATE to channel members via gateway
      const serverId = await getServerIdFromChannel(request.params.channelId);
      if (serverId) {
        dispatchToChannel(serverId, GatewayEvent.MESSAGE_UPDATE, msg);
      }

      return msg;
    },
  );

  // DELETE /channels/:channelId/messages/:id — Delete message
  app.delete<{ Params: { channelId: string; id: string } }>(
    "/channels/:channelId/messages/:id",
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      // Resolve permissions for MANAGE_MESSAGES check
      const serverId = await getServerIdFromChannel(request.params.channelId);
      if (!serverId) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Channel not found", status: 404 } });
      }
      const perms = await resolvePermissions(request.userId, serverId);
      const result = await messageService.deleteMessage(request.params.id, request.userId, perms);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      // Dispatch MESSAGE_DELETE to channel members via gateway
      dispatchToChannel(serverId, GatewayEvent.MESSAGE_DELETE, {
        id: request.params.id,
        channelId: request.params.channelId,
      });

      return result.data;
    },
  );
}
