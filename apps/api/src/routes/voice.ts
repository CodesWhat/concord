import type { FastifyInstance } from "fastify";
import { requireAuth, requireChannelPermission, requireMember } from "../middleware/permissions.js";
import { Permissions } from "@concord/shared";
import * as voiceService from "../services/voice.js";

export default async function voiceRoutes(app: FastifyInstance) {
  // POST /servers/:serverId/channels/:channelId/voice/join
  app.post<{
    Params: { serverId: string; channelId: string };
  }>(
    "/servers/:serverId/channels/:channelId/voice/join",
    {
      preHandler: [requireAuth, requireChannelPermission(Permissions.CONNECT_VOICE)],
    },
    async (request, reply) => {
      const { serverId, channelId } = request.params;
      const result = await voiceService.joinVoiceChannel(request.userId, serverId, channelId);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // POST /servers/:serverId/channels/:channelId/voice/leave
  app.post<{
    Params: { serverId: string; channelId: string };
  }>(
    "/servers/:serverId/channels/:channelId/voice/leave",
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { serverId, channelId } = request.params;
      const result = await voiceService.leaveVoiceChannel(request.userId, serverId, channelId);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return reply.code(204).send();
    },
  );

  // GET /servers/:serverId/voice-states
  app.get<{
    Params: { serverId: string };
  }>(
    "/servers/:serverId/voice-states",
    {
      preHandler: [requireAuth, requireMember((req) => (req.params as Record<string, string>)["serverId"])],
    },
    async (request, reply) => {
      const { serverId } = request.params;
      const result = await voiceService.getVoiceStates(serverId);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );
}
