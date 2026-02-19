import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/permissions.js";
import * as dmService from "../services/dms.js";
import { dispatchToUser, GatewayEvent } from "../gateway/index.js";

export default async function dmRoutes(app: FastifyInstance) {
  // POST /dms — Get or create a DM channel with another user
  app.post<{ Body: { recipientId: string } }>(
    "/dms",
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
      const { recipientId } = request.body;
      if (!recipientId || typeof recipientId !== "string") {
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: "recipientId is required", statusCode: 400 },
        });
      }
      if (recipientId === request.userId) {
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: "Cannot DM yourself", statusCode: 400 },
        });
      }

      const result = await dmService.getOrCreateDmChannel(
        request.userId,
        recipientId,
      );
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return reply.code(200).send(result.data);
    },
  );

  // GET /dms — List all DM channels for the current user
  app.get(
    "/dms",
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const result = await dmService.getDmChannels(request.userId);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // GET /dms/:dmChannelId/messages — Get messages in a DM channel
  app.get<{
    Params: { dmChannelId: string };
    Querystring: { before?: string; limit?: string };
  }>(
    "/dms/:dmChannelId/messages",
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const limit = request.query.limit
        ? parseInt(request.query.limit, 10)
        : 50;
      const result = await dmService.getDmMessages(
        request.params.dmChannelId,
        request.userId,
        request.query.before,
        limit,
      );
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // POST /dms/:dmChannelId/messages — Send a message in a DM channel
  app.post<{
    Params: { dmChannelId: string };
    Body: { content: string };
  }>(
    "/dms/:dmChannelId/messages",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
        },
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { content } = request.body;
      if (!content || content.trim().length === 0) {
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: "Message content is required", statusCode: 400 },
        });
      }
      if (content.length > 4000) {
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: "Message content too long (max 4000 characters)", statusCode: 400 },
        });
      }

      const result = await dmService.sendDmMessage(
        request.params.dmChannelId,
        request.userId,
        content.trim(),
      );
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      const msg = result.data!;

      // Dispatch DM_MESSAGE_CREATE to both participants
      const participantIds = await dmService.getDmParticipantIds(
        request.params.dmChannelId,
      );
      for (const participantId of participantIds) {
        dispatchToUser(participantId, GatewayEvent.DM_MESSAGE_CREATE, msg);
      }

      return reply.code(201).send(msg);
    },
  );
}
