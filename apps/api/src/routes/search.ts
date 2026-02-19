import type { FastifyInstance } from "fastify";
import { requireAuth, requireMember } from "../middleware/permissions.js";
import * as searchService from "../services/search.js";

export default async function searchRoutes(app: FastifyInstance) {
  // GET /servers/:serverId/search — Search messages in a server
  app.get<{
    Params: { serverId: string };
    Querystring: {
      q: string;
      channelId?: string;
      authorId?: string;
      before?: string;
      after?: string;
      limit?: string;
    };
  }>(
    "/servers/:serverId/search",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { serverId: string }).serverId),
      ],
    },
    async (request, reply) => {
      const { q, channelId, authorId, before, after, limit } = request.query;

      // Validate query
      const trimmedQuery = q?.trim();
      if (!trimmedQuery || trimmedQuery.length === 0) {
        return reply.code(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "Search query is required",
            statusCode: 400,
          },
        });
      }
      if (trimmedQuery.length > 200) {
        return reply.code(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "Search query must be 200 characters or fewer",
            statusCode: 400,
          },
        });
      }

      const safeLimit = limit ? parseInt(limit, 10) : 25;

      const result = await searchService.searchMessages(
        request.params.serverId,
        trimmedQuery,
        {
          channelId,
          authorId,
          before,
          after,
          limit: safeLimit,
        },
      );

      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      return result.data;
    },
  );
}
