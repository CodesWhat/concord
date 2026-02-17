import type { FastifyInstance } from "fastify";
import {
  requireAuth,
  requireChannelPermission,
} from "../middleware/permissions.js";
import { Permissions } from "@concord/shared";
import * as readStateService from "../services/readState.js";
import { dispatchToUser, GatewayEvent } from "../gateway/index.js";

export default async function readStateRoutes(app: FastifyInstance) {
  // PUT /channels/:channelId/read-state — Mark channel as read
  app.put<{ Params: { channelId: string }; Body: { messageId: string } }>(
    "/channels/:channelId/read-state",
    {
      preHandler: [
        requireAuth,
        requireChannelPermission(Permissions.READ_MESSAGES),
      ],
    },
    async (request, reply) => {
      const { messageId } = request.body;
      if (!messageId) {
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: "messageId is required", status: 400 },
        });
      }

      const result = await readStateService.markAsRead(
        request.userId,
        request.params.channelId,
        messageId,
      );

      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      // Dispatch READ_STATE_UPDATE to all user's connections
      dispatchToUser(request.userId, GatewayEvent.READ_STATE_UPDATE, result.data);

      return result.data;
    },
  );

  // GET /users/@me/read-state — Get all read states for current user
  app.get(
    "/users/@me/read-state",
    { preHandler: [requireAuth] },
    async (request, _reply) => {
      return readStateService.getUserReadStates(request.userId);
    },
  );
}
