// Register in index.ts: import forumRoutes from "./routes/forum.js"; server.register(forumRoutes, { prefix: "/api/v1" });

import type { FastifyInstance } from "fastify";
import {
  requireAuth,
  requireChannelPermission,
  resolvePermissions,
  getServerIdFromChannel,
} from "../middleware/permissions.js";
import * as forumService from "../services/forum.js";
import { Permissions, hasPermission } from "@concord/shared";
import { dispatchToChannel, GatewayEvent } from "../gateway/index.js";

export default async function forumRoutes(app: FastifyInstance) {
  // GET /channels/:channelId/posts — List posts in a forum channel
  app.get<{
    Params: { channelId: string };
    Querystring: { sort?: string; before?: string; limit?: string };
  }>(
    "/channels/:channelId/posts",
    {
      preHandler: [
        requireAuth,
        requireChannelPermission(Permissions.READ_MESSAGES),
      ],
    },
    async (request, reply) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 25;
      const result = await forumService.getPosts(request.params.channelId, {
        sort: request.query.sort,
        before: request.query.before,
        limit,
      });
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // POST /channels/:channelId/posts — Create a new post
  app.post<{
    Params: { channelId: string };
    Body: { title: string; content: string; tags?: string[] };
  }>(
    "/channels/:channelId/posts",
    {
      preHandler: [
        requireAuth,
        requireChannelPermission(Permissions.SEND_MESSAGES),
      ],
    },
    async (request, reply) => {
      const { title, content, tags } = request.body;
      if (!content || content.trim().length === 0) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Post content is required", status: 400 } });
      }
      const result = await forumService.createPost(
        request.params.channelId,
        request.userId,
        { title, content, tags },
      );
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      const serverId = await getServerIdFromChannel(request.params.channelId);
      if (serverId) {
        dispatchToChannel(serverId, GatewayEvent.POST_CREATE, result.data);
      }

      return reply.code(201).send(result.data);
    },
  );

  // GET /posts/:postId — Get a single post
  app.get<{ Params: { postId: string } }>(
    "/posts/:postId",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const result = await forumService.getPost(request.params.postId);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      // Verify READ_MESSAGES on the channel
      const serverId = await getServerIdFromChannel(result.data!.channelId);
      if (!serverId) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Channel not found", status: 404 } });
      }
      const perms = await resolvePermissions(request.userId, serverId);
      if (!hasPermission(perms, Permissions.READ_MESSAGES)) {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Missing required permission", status: 403 } });
      }

      return result.data;
    },
  );

  // PATCH /posts/:postId — Update a post
  app.patch<{
    Params: { postId: string };
    Body: { title?: string; content?: string; tags?: string[]; pinned?: boolean; locked?: boolean };
  }>(
    "/posts/:postId",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const result = await forumService.updatePost(
        request.params.postId,
        request.userId,
        request.body,
      );
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      const serverId = await getServerIdFromChannel(result.data!.channelId);
      if (serverId) {
        dispatchToChannel(serverId, GatewayEvent.POST_UPDATE, result.data);
      }

      return result.data;
    },
  );

  // DELETE /posts/:postId — Delete a post
  app.delete<{ Params: { postId: string } }>(
    "/posts/:postId",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      // Get the post first to check ownership / permissions
      const postResult = await forumService.getPost(request.params.postId);
      if (postResult.error) {
        return reply.code(postResult.error.statusCode).send({ error: postResult.error });
      }

      const post = postResult.data!;
      const serverId = await getServerIdFromChannel(post.channelId);
      if (!serverId) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Channel not found", status: 404 } });
      }

      // Author can always delete their own posts. Otherwise need MANAGE_MESSAGES.
      if (post.authorId !== request.userId) {
        const perms = await resolvePermissions(request.userId, serverId);
        if (!hasPermission(perms, Permissions.MANAGE_MESSAGES)) {
          return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Cannot delete this post", status: 403 } });
        }
      }

      const result = await forumService.deletePost(request.params.postId);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      dispatchToChannel(serverId, GatewayEvent.POST_DELETE, {
        id: request.params.postId,
        channelId: post.channelId,
      });

      return result.data;
    },
  );

  // POST /posts/:postId/vote — Vote on a post
  app.post<{
    Params: { postId: string };
    Body: { value: number };
  }>(
    "/posts/:postId/vote",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { value } = request.body;
      if (value !== 1 && value !== -1 && value !== 0) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Vote value must be 1, -1, or 0", status: 400 } });
      }

      const result = await forumService.vote(
        request.params.postId,
        request.userId,
        value,
      );
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      // Get post to find channelId for dispatch
      const postResult = await forumService.getPost(request.params.postId);
      if (postResult.data) {
        const serverId = await getServerIdFromChannel(postResult.data.channelId);
        if (serverId) {
          dispatchToChannel(serverId, GatewayEvent.POST_VOTE, {
            postId: request.params.postId,
            ...result.data,
          });
        }
      }

      return result.data;
    },
  );

  // GET /posts/:postId/comments — List comments on a post
  app.get<{
    Params: { postId: string };
    Querystring: { before?: string; limit?: string };
  }>(
    "/posts/:postId/comments",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 25;
      const result = await forumService.getComments(request.params.postId, {
        before: request.query.before,
        limit,
      });
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return result.data;
    },
  );

  // POST /posts/:postId/comments — Create a comment on a post
  app.post<{
    Params: { postId: string };
    Body: { content: string };
  }>(
    "/posts/:postId/comments",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { content } = request.body;
      if (!content || content.trim().length === 0) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Comment content is required", status: 400 } });
      }
      if (content.length > 4000) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Comment content too long (max 4000 characters)", status: 400 } });
      }

      // Resolve channelId from the post
      const postResult = await forumService.getPost(request.params.postId);
      if (postResult.error) {
        return reply.code(postResult.error.statusCode).send({ error: postResult.error });
      }

      const result = await forumService.createComment(
        request.params.postId,
        postResult.data!.channelId,
        request.userId,
        content,
      );
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }

      const serverId = await getServerIdFromChannel(postResult.data!.channelId);
      if (serverId) {
        dispatchToChannel(serverId, GatewayEvent.MESSAGE_CREATE, result.data);
      }

      return reply.code(201).send(result.data);
    },
  );
}
