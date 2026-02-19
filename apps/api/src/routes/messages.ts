import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import {
  requireAuth,
  requireChannelPermission,
  resolvePermissions,
  getServerIdFromChannel,
} from "../middleware/permissions.js";
import * as messageService from "../services/messages.js";
import { hasPermission, Permissions } from "@concord/shared";
import { dispatchToChannel, GatewayEvent } from "../gateway/index.js";
import { db } from "../db.js";
import { channels, messages } from "../models/schema.js";

export default async function messageRoutes(app: FastifyInstance) {
  // POST /channels/:channelId/messages — Send message
  app.post<{ Params: { channelId: string }; Body: { content: string; replyToId?: string; attachments?: unknown[] } }>(
    "/channels/:channelId/messages",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
        },
      },
      preHandler: [
        requireAuth,
        requireChannelPermission(Permissions.SEND_MESSAGES),
      ],
    },
    async (request, reply) => {
      // Enforce slowmode
      const [channel] = await db
        .select({ slowmodeSeconds: channels.slowmodeSeconds })
        .from(channels)
        .where(eq(channels.id, request.params.channelId))
        .limit(1);

      if (channel && channel.slowmodeSeconds > 0) {
        const canBypass =
          request.memberPermissions !== undefined &&
          (hasPermission(request.memberPermissions, Permissions.MANAGE_MESSAGES) ||
            hasPermission(request.memberPermissions, Permissions.ADMINISTRATOR));

        if (!canBypass) {
          const [lastMsg] = await db
            .select({ createdAt: messages.createdAt })
            .from(messages)
            .where(
              and(
                eq(messages.channelId, request.params.channelId),
                eq(messages.authorId, request.userId),
                eq(messages.deleted, false),
              ),
            )
            .orderBy(desc(messages.createdAt))
            .limit(1);

          if (lastMsg) {
            const elapsed = (Date.now() - new Date(lastMsg.createdAt).getTime()) / 1000;
            if (elapsed < channel.slowmodeSeconds) {
              const wait = Math.ceil(channel.slowmodeSeconds - elapsed);
              return reply.code(429).send({
                error: { code: "SLOWMODE", message: `Slow mode active. Wait ${wait} seconds.`, statusCode: 429 },
              });
            }
          }
        }
      }

      const { content, replyToId, attachments } = request.body;
      const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
      if ((!content || content.trim().length === 0) && !hasAttachments) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Message content or attachments required", status: 400 } });
      }
      if (content && content.length > 4000) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Message content too long (max 4000 characters)", status: 400 } });
      }
      const result = await messageService.createMessage(
        request.params.channelId,
        request.userId,
        content ?? "",
        replyToId,
        hasAttachments ? attachments : undefined,
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
