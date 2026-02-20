import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/permissions.js";
import { getActivity } from "../services/activity.js";

export default async function activityRoutes(app: FastifyInstance) {
  // GET /users/@me/activity
  app.get<{
    Querystring: {
      before?: string;
      limit?: string;
      type?: "mention" | "reply" | "reaction";
    };
  }>(
    "/users/@me/activity",
    {
      preHandler: [requireAuth],
    },
    async (request, _reply) => {
      const limit = request.query.limit
        ? parseInt(request.query.limit, 10)
        : 30;
      const items = await getActivity(request.userId, {
        type: request.query.type,
        before: request.query.before,
        limit,
      });
      return items;
    },
  );
}
