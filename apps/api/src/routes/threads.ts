import type { FastifyInstance } from "fastify";
import {
  requireAuth,
  requireChannelPermission,
  resolvePermissions,
  getServerIdFromChannel,
} from "../middleware/permissions.js";
import * as threadService from "../services/threads.js";
import { Permissions, hasPermission } from "@concord/shared";
import { dispatchToChannel, GatewayEvent } from "../gateway/index.js";

/** Look up a thread, resolve its channelId -> serverId, and check permissions. */
async function resolveThreadContext(threadId: string) {
  const threadResult = await threadService.getThread(threadId);
  if (threadResult.error) return null;

  const thread = threadResult.data!;
  const serverId = await getServerIdFromChannel(thread.channelId);
  if (!serverId) return null;

  return { thread, serverId };
}

export default async function threadRoutes(app: FastifyInstance) {
  // POST /channels/:channelId/threads - Create thread from a message
  app.post<{
    Params: { channelId: string };
    Body: { parentMessageId: string; name: string };
  }>(
    "/channels/:channelId/threads",
    {
      preHandler: [
        requireAuth,
        requireChannelPermission(Permissions.SEND_MESSAGES),
      ],
    },
    async (request, reply) => {
      const { parentMessageId, name } = request.body;

      if (!parentMessageId) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "parentMessageId is required", status: 400 } });
      }

      const result = await threadService.createThread(
        request.params.channelId,
        parentMessageId,
        name,
        request.userId,
      );

      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      const thread = result.data!;

      const serverId = await getServerIdFromChannel(request.params.channelId);
      if (serverId) {
        dispatchToChannel(serverId, GatewayEvent.THREAD_CREATE, thread);
      }

      return reply.code(201).send(thread);
    },
  );

  // GET /channels/:channelId/threads - List threads
  app.get<{
    Params: { channelId: string };
    Querystring: { archived?: string };
  }>(
    "/channels/:channelId/threads",
    {
      preHandler: [
        requireAuth,
        requireChannelPermission(Permissions.READ_MESSAGES),
      ],
    },
    async (request, reply) => {
      const includeArchived = request.query.archived === "true";
      const result = await threadService.getChannelThreads(
        request.params.channelId,
        includeArchived,
      );
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // GET /threads/:threadId - Get single thread
  app.get<{ Params: { threadId: string } }>(
    "/threads/:threadId",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const ctx = await resolveThreadContext(request.params.threadId);
      if (!ctx) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Thread not found", status: 404 } });
      }

      // Check that user has READ_MESSAGES on the parent channel
      const perms = await resolvePermissions(request.userId, ctx.serverId);
      if (!hasPermission(perms, Permissions.READ_MESSAGES)) {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Missing required permission", status: 403 } });
      }

      return ctx.thread;
    },
  );

  // GET /threads/:threadId/messages - Get thread messages (paginated)
  app.get<{
    Params: { threadId: string };
    Querystring: { before?: string; limit?: string };
  }>(
    "/threads/:threadId/messages",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const ctx = await resolveThreadContext(request.params.threadId);
      if (!ctx) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Thread not found", status: 404 } });
      }

      const perms = await resolvePermissions(request.userId, ctx.serverId);
      if (!hasPermission(perms, Permissions.READ_MESSAGES)) {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Missing required permission", status: 403 } });
      }

      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
      const result = await threadService.getThreadMessages(
        request.params.threadId,
        request.query.before,
        limit,
      );

      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // POST /threads/:threadId/messages - Send message in thread
  app.post<{
    Params: { threadId: string };
    Body: { content: string; replyToId?: string };
  }>(
    "/threads/:threadId/messages",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const ctx = await resolveThreadContext(request.params.threadId);
      if (!ctx) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Thread not found", status: 404 } });
      }

      const perms = await resolvePermissions(request.userId, ctx.serverId);
      if (!hasPermission(perms, Permissions.SEND_MESSAGES)) {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Missing required permission", status: 403 } });
      }

      const { content, replyToId } = request.body;
      if (!content || content.trim().length === 0) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Message content is required", status: 400 } });
      }
      if (content.length > 4000) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Message content too long (max 4000 characters)", status: 400 } });
      }

      const result = await threadService.sendThreadMessage(
        request.params.threadId,
        request.userId,
        content,
        replyToId,
      );

      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      const msg = result.data!;
      dispatchToChannel(ctx.serverId, GatewayEvent.THREAD_MESSAGE_CREATE, msg);

      return reply.code(201).send(msg);
    },
  );

  // PATCH /threads/:threadId - Update thread (rename/archive)
  app.patch<{
    Params: { threadId: string };
    Body: { name?: string; archived?: boolean };
  }>(
    "/threads/:threadId",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const ctx = await resolveThreadContext(request.params.threadId);
      if (!ctx) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Thread not found", status: 404 } });
      }

      const perms = await resolvePermissions(request.userId, ctx.serverId);
      if (!hasPermission(perms, Permissions.MANAGE_THREADS)) {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Missing required permission", status: 403 } });
      }

      const result = await threadService.updateThread(
        request.params.threadId,
        request.body,
      );

      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      const thread = result.data!;
      dispatchToChannel(ctx.serverId, GatewayEvent.THREAD_UPDATE, thread);

      return thread;
    },
  );
}
