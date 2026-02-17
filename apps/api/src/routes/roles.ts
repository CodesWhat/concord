import type { FastifyInstance } from "fastify";
import {
  requireAuth,
  requireMember,
  requirePermission,
} from "../middleware/permissions.js";
import * as roleService from "../services/roles.js";
import { Permissions, hasPermission } from "@concord/shared";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { servers, roles } from "../models/schema.js";
import { dispatchToServer, GatewayEvent } from "../gateway/index.js";

export default async function roleRoutes(app: FastifyInstance) {
  // GET /:serverId/roles — List roles
  app.get<{ Params: { serverId: string } }>(
    "/:serverId/roles",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { serverId: string }).serverId),
      ],
    },
    async (request, reply) => {
      const result = await roleService.getRoles(request.params.serverId);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // POST /:serverId/roles — Create role
  app.post<{
    Params: { serverId: string };
    Body: { name: string; color?: string; permissions?: number; mentionable?: boolean; hoisted?: boolean };
  }>(
    "/:serverId/roles",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { serverId: string }).serverId),
        requirePermission(Permissions.MANAGE_ROLES),
      ],
    },
    async (request, reply) => {
      const { name, color, permissions, mentionable, hoisted } = request.body;
      if (!name || name.trim().length === 0) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Role name is required", status: 400 } });
      }

      const result = await roleService.createRole(request.params.serverId, {
        name: name.trim(),
        color,
        permissions,
        mentionable,
        hoisted,
      });

      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      dispatchToServer(request.params.serverId, GatewayEvent.ROLE_CREATE, result.data);
      return reply.code(201).send(result.data);
    },
  );

  // PATCH /:serverId/roles/:roleId — Update role
  app.patch<{
    Params: { serverId: string; roleId: string };
    Body: { name?: string; color?: string; permissions?: number; mentionable?: boolean; hoisted?: boolean };
  }>(
    "/:serverId/roles/:roleId",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { serverId: string }).serverId),
        requirePermission(Permissions.MANAGE_ROLES),
      ],
    },
    async (request, reply) => {
      const { serverId, roleId } = request.params;

      // Hierarchy check
      const server = await db
        .select({ ownerId: servers.ownerId })
        .from(servers)
        .where(eq(servers.id, serverId))
        .limit(1);

      const isOwner = server[0]?.ownerId === request.userId;

      if (!isOwner) {
        const callerHighest = await roleService.getHighestRolePosition(request.userId, serverId);
        const targetRole = await db
          .select({ position: roles.position })
          .from(roles)
          .where(and(eq(roles.id, roleId), eq(roles.serverId, serverId)))
          .limit(1);

        if (!targetRole[0] || targetRole[0].position >= callerHighest) {
          return reply.code(403).send({
            error: { code: "FORBIDDEN", message: "Cannot modify a role at or above your highest role", status: 403 },
          });
        }

        // Can't grant ADMINISTRATOR permission without having it yourself
        if (
          request.body.permissions !== undefined &&
          hasPermission(request.body.permissions, Permissions.ADMINISTRATOR) &&
          !hasPermission(request.memberPermissions ?? 0, Permissions.ADMINISTRATOR)
        ) {
          return reply.code(403).send({
            error: { code: "FORBIDDEN", message: "Cannot grant ADMINISTRATOR permission without having it", status: 403 },
          });
        }
      }

      const result = await roleService.updateRole(roleId, serverId, request.body);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      dispatchToServer(serverId, GatewayEvent.ROLE_UPDATE, result.data);
      return result.data;
    },
  );

  // DELETE /:serverId/roles/:roleId — Delete role
  app.delete<{ Params: { serverId: string; roleId: string } }>(
    "/:serverId/roles/:roleId",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { serverId: string }).serverId),
        requirePermission(Permissions.MANAGE_ROLES),
      ],
    },
    async (request, reply) => {
      const { serverId, roleId } = request.params;

      // Hierarchy check
      const server = await db
        .select({ ownerId: servers.ownerId })
        .from(servers)
        .where(eq(servers.id, serverId))
        .limit(1);

      const isOwner = server[0]?.ownerId === request.userId;

      if (!isOwner) {
        const callerHighest = await roleService.getHighestRolePosition(request.userId, serverId);
        const targetRole = await db
          .select({ position: roles.position })
          .from(roles)
          .where(and(eq(roles.id, roleId), eq(roles.serverId, serverId)))
          .limit(1);

        if (!targetRole[0] || targetRole[0].position >= callerHighest) {
          return reply.code(403).send({
            error: { code: "FORBIDDEN", message: "Cannot modify a role at or above your highest role", status: 403 },
          });
        }
      }

      const result = await roleService.deleteRole(roleId, serverId);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      dispatchToServer(serverId, GatewayEvent.ROLE_DELETE, { roleId, serverId });
      return reply.code(200).send(result.data);
    },
  );

  // PUT /:serverId/members/:userId/roles/:roleId — Assign role
  app.put<{ Params: { serverId: string; userId: string; roleId: string } }>(
    "/:serverId/members/:userId/roles/:roleId",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { serverId: string }).serverId),
        requirePermission(Permissions.MANAGE_ROLES),
      ],
    },
    async (request, reply) => {
      const { serverId, userId, roleId } = request.params;

      // Hierarchy check on role being assigned
      const server = await db
        .select({ ownerId: servers.ownerId })
        .from(servers)
        .where(eq(servers.id, serverId))
        .limit(1);

      const isOwner = server[0]?.ownerId === request.userId;

      if (!isOwner) {
        const callerHighest = await roleService.getHighestRolePosition(request.userId, serverId);
        const targetRole = await db
          .select({ position: roles.position })
          .from(roles)
          .where(and(eq(roles.id, roleId), eq(roles.serverId, serverId)))
          .limit(1);

        if (!targetRole[0] || targetRole[0].position >= callerHighest) {
          return reply.code(403).send({
            error: { code: "FORBIDDEN", message: "Cannot assign a role at or above your highest role", status: 403 },
          });
        }
      }

      const result = await roleService.assignRole(userId, serverId, roleId);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      dispatchToServer(serverId, GatewayEvent.MEMBER_ROLE_UPDATE, {
        userId,
        serverId,
        roleId,
        action: "add",
      });
      return reply.code(200).send(result.data);
    },
  );

  // DELETE /:serverId/members/:userId/roles/:roleId — Remove role
  app.delete<{ Params: { serverId: string; userId: string; roleId: string } }>(
    "/:serverId/members/:userId/roles/:roleId",
    {
      preHandler: [
        requireAuth,
        requireMember((req) => (req.params as { serverId: string }).serverId),
        requirePermission(Permissions.MANAGE_ROLES),
      ],
    },
    async (request, reply) => {
      const { serverId, userId, roleId } = request.params;

      // Hierarchy check
      const server = await db
        .select({ ownerId: servers.ownerId })
        .from(servers)
        .where(eq(servers.id, serverId))
        .limit(1);

      const isOwner = server[0]?.ownerId === request.userId;

      if (!isOwner) {
        const callerHighest = await roleService.getHighestRolePosition(request.userId, serverId);
        const targetRole = await db
          .select({ position: roles.position })
          .from(roles)
          .where(and(eq(roles.id, roleId), eq(roles.serverId, serverId)))
          .limit(1);

        if (!targetRole[0] || targetRole[0].position >= callerHighest) {
          return reply.code(403).send({
            error: { code: "FORBIDDEN", message: "Cannot remove a role at or above your highest role", status: 403 },
          });
        }
      }

      const result = await roleService.removeRole(userId, serverId, roleId);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      dispatchToServer(serverId, GatewayEvent.MEMBER_ROLE_UPDATE, {
        userId,
        serverId,
        roleId,
        action: "remove",
      });
      return reply.code(200).send(result.data);
    },
  );
}
