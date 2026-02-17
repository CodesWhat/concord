import type { FastifyInstance } from "fastify";
import {
  requireAuth,
  requireMember,
  requirePermission,
  requireChannelPermission,
  getServerIdFromChannel,
} from "../middleware/permissions.js";
import * as channelService from "../services/channels.js";
import { Permissions } from "@concord/shared";
import { dispatchToChannel, GatewayEvent } from "../gateway/index.js";

export default async function channelRoutes(app: FastifyInstance) {
  // POST /servers/:serverId/channels — Create channel
  app.post<{ Params: { serverId: string }; Body: { name: string; type?: "text" | "voice" | "announcement" | "stage"; categoryId?: string } }>(
    "/servers/:serverId/channels",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { serverId: string }).serverId),
        requirePermission(Permissions.MANAGE_CHANNELS),
      ],
    },
    async (request, reply) => {
      const { name, type, categoryId } = request.body;
      if (!name || name.trim().length === 0) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Channel name is required", status: 400 } });
      }
      const result = await channelService.createChannel(
        request.params.serverId,
        name.trim(),
        type ?? "text",
        categoryId,
      );
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return reply.code(201).send(result.data);
    },
  );

  // GET /channels/:id — Get channel
  app.get<{ Params: { id: string } }>(
    "/channels/:id",
    {
      preHandler: [
        requireAuth,
        requireChannelPermission(Permissions.READ_MESSAGES),
      ],
    },
    async (request, reply) => {
      const result = await channelService.getChannel(request.params.id);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // PATCH /channels/:id — Update channel
  app.patch<{ Params: { id: string }; Body: { name?: string; topic?: string; nsfw?: boolean; slowmodeSeconds?: number } }>(
    "/channels/:id",
    {
      preHandler: [
        requireAuth,
        requireChannelPermission(Permissions.MANAGE_CHANNELS),
      ],
    },
    async (request, reply) => {
      const result = await channelService.updateChannel(request.params.id, request.body);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // DELETE /channels/:id — Delete channel
  app.delete<{ Params: { id: string } }>(
    "/channels/:id",
    {
      preHandler: [
        requireAuth,
        requireChannelPermission(Permissions.MANAGE_CHANNELS),
      ],
    },
    async (request, reply) => {
      const result = await channelService.deleteChannel(request.params.id);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // POST /channels/:channelId/typing — Trigger typing indicator
  app.post<{ Params: { channelId: string } }>(
    "/channels/:channelId/typing",
    {
      preHandler: [
        requireAuth,
        requireChannelPermission(Permissions.SEND_MESSAGES),
      ],
    },
    async (request, reply) => {
      const serverId = await getServerIdFromChannel(request.params.channelId);
      if (!serverId) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Channel not found", status: 404 } });
      }
      dispatchToChannel(serverId, GatewayEvent.TYPING_START, {
        channelId: request.params.channelId,
        userId: request.userId,
      });
      return reply.code(204).send();
    },
  );
}
