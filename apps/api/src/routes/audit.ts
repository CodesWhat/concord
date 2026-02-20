import type { FastifyInstance } from "fastify";
import { requireAuth, requireMember, requirePermission } from "../middleware/permissions.js";
import { Permissions } from "@concord/shared";
import { getAuditLog } from "../services/audit.js";

export default async function auditRoutes(app: FastifyInstance) {
  // GET /servers/:serverId/audit-log
  app.get<{
    Params: { serverId: string };
    Querystring: { before?: string; limit?: string; action?: string; actorId?: string };
  }>(
    "/servers/:serverId/audit-log",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { serverId: string }).serverId),
        requirePermission(Permissions.VIEW_AUDIT_LOG),
      ],
    },
    async (request, _reply) => {
      const { serverId } = request.params;
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;

      const entries = await getAuditLog(serverId, {
        actorId: request.query.actorId,
        action: request.query.action,
        before: request.query.before,
        limit,
      });

      return entries;
    },
  );
}
