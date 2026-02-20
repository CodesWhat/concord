import type { FastifyInstance } from "fastify";
import { requireAuth, requirePermission } from "../middleware/permissions.js";
import { Permissions } from "@concord/shared";
import * as automod from "../services/automod.js";
import { logAction, AuditAction } from "../services/audit.js";

export default async function automodRoutes(app: FastifyInstance) {
  // GET /servers/:serverId/automod/rules
  app.get<{ Params: { serverId: string } }>(
    "/servers/:serverId/automod/rules",
    {
      preHandler: [requireAuth, requirePermission(Permissions.MANAGE_SERVER)],
    },
    async (request, reply) => {
      const result = await automod.listRules(request.params.serverId);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // POST /servers/:serverId/automod/rules
  app.post<{
    Params: { serverId: string };
    Body: {
      name: string;
      type: string;
      config?: Record<string, unknown>;
      action?: string;
      enabled?: boolean;
    };
  }>(
    "/servers/:serverId/automod/rules",
    {
      preHandler: [requireAuth, requirePermission(Permissions.MANAGE_SERVER)],
    },
    async (request, reply) => {
      const { name, type, config, action, enabled } = request.body;

      if (!name || !type) {
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: "name and type are required", statusCode: 400 },
        });
      }

      const validTypes = ["word_filter", "link_filter", "spam", "raid"];
      if (!validTypes.includes(type)) {
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: `type must be one of: ${validTypes.join(", ")}`, statusCode: 400 },
        });
      }

      const result = await automod.createRule(request.params.serverId, {
        name,
        type,
        config,
        action,
        enabled,
      });

      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      logAction(
        request.params.serverId,
        request.userId,
        AuditAction.AUTOMOD_RULE_CREATE,
        "automod_rule",
        result.data!.id,
        { name, type },
      );

      return reply.code(201).send(result.data);
    },
  );

  // PATCH /servers/:serverId/automod/rules/:ruleId
  app.patch<{
    Params: { serverId: string; ruleId: string };
    Body: Partial<{
      name: string;
      config: Record<string, unknown>;
      action: string;
      enabled: boolean;
    }>;
  }>(
    "/servers/:serverId/automod/rules/:ruleId",
    {
      preHandler: [requireAuth, requirePermission(Permissions.MANAGE_SERVER)],
    },
    async (request, reply) => {
      const result = await automod.updateRule(
        request.params.ruleId,
        request.params.serverId,
        request.body,
      );

      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      logAction(
        request.params.serverId,
        request.userId,
        AuditAction.AUTOMOD_RULE_UPDATE,
        "automod_rule",
        request.params.ruleId,
        request.body as Record<string, unknown>,
      );

      return result.data;
    },
  );

  // DELETE /servers/:serverId/automod/rules/:ruleId
  app.delete<{ Params: { serverId: string; ruleId: string } }>(
    "/servers/:serverId/automod/rules/:ruleId",
    {
      preHandler: [requireAuth, requirePermission(Permissions.MANAGE_SERVER)],
    },
    async (request, reply) => {
      const result = await automod.deleteRule(
        request.params.ruleId,
        request.params.serverId,
      );

      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      logAction(
        request.params.serverId,
        request.userId,
        AuditAction.AUTOMOD_RULE_DELETE,
        "automod_rule",
        request.params.ruleId,
      );

      return reply.code(204).send();
    },
  );
}
