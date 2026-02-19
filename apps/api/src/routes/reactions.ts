import type { FastifyInstance } from "fastify";
import {
  requireAuth,
  requireChannelPermission,
  getServerIdFromChannel,
} from "../middleware/permissions.js";
import * as reactionService from "../services/reactions.js";
import { Permissions } from "@concord/shared";
import { dispatchToChannel, GatewayEvent } from "../gateway/index.js";

export default async function reactionRoutes(app: FastifyInstance) {
  // POST /channels/:channelId/reactions/batch — Batch fetch reactions for multiple messages
  app.post<{
    Params: { channelId: string };
    Body: { messageIds: string[] };
  }>(
    "/channels/:channelId/reactions/batch",
    {
      preHandler: [
        requireAuth,
        requireChannelPermission(Permissions.READ_MESSAGES),
      ],
    },
    async (request, reply) => {
      const { messageIds } = request.body;
      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "messageIds array required", statusCode: 400 } });
      }
      // Limit to 100 message IDs
      const limited = messageIds.slice(0, 100);
      const result = await reactionService.getReactionsBatch(limited);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // PUT /channels/:channelId/messages/:messageId/reactions/:emoji — Add reaction
  app.put<{ Params: { channelId: string; messageId: string; emoji: string } }>(
    "/channels/:channelId/messages/:messageId/reactions/:emoji",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
        },
      },
      preHandler: [
        requireAuth,
        requireChannelPermission(Permissions.ADD_REACTIONS),
      ],
    },
    async (request, reply) => {
      const { channelId, messageId, emoji } = request.params;
      const decodedEmoji = decodeURIComponent(emoji);

      const result = await reactionService.addReaction(messageId, request.userId, decodedEmoji);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      const serverId = await getServerIdFromChannel(channelId);
      if (serverId) {
        dispatchToChannel(serverId, GatewayEvent.REACTION_ADD, {
          messageId,
          channelId,
          userId: request.userId,
          emoji: decodedEmoji,
        });
      }

      return reply.code(200).send(result.data);
    },
  );

  // DELETE /channels/:channelId/messages/:messageId/reactions/:emoji — Remove own reaction
  app.delete<{ Params: { channelId: string; messageId: string; emoji: string } }>(
    "/channels/:channelId/messages/:messageId/reactions/:emoji",
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { channelId, messageId, emoji } = request.params;
      const decodedEmoji = decodeURIComponent(emoji);

      const result = await reactionService.removeReaction(messageId, request.userId, decodedEmoji);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      const serverId = await getServerIdFromChannel(channelId);
      if (serverId) {
        dispatchToChannel(serverId, GatewayEvent.REACTION_REMOVE, {
          messageId,
          channelId,
          userId: request.userId,
          emoji: decodedEmoji,
        });
      }

      return reply.code(200).send(result.data);
    },
  );

  // GET /channels/:channelId/messages/:messageId/reactions — List reactions
  app.get<{ Params: { channelId: string; messageId: string } }>(
    "/channels/:channelId/messages/:messageId/reactions",
    {
      preHandler: [
        requireAuth,
        requireChannelPermission(Permissions.READ_MESSAGES),
      ],
    },
    async (request, reply) => {
      const result = await reactionService.getReactions(request.params.messageId);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );
}
