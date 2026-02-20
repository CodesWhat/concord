import type { FastifyInstance } from "fastify";
import { eq, and, desc, lt } from "drizzle-orm";
import { db } from "../db.js";
import { channels, messages, forumPosts, users } from "../models/schema.js";

export default async function publicRoutes(app: FastifyInstance) {
  // GET /public/servers/:serverId/channels — list public channels (no auth)
  app.get<{ Params: { serverId: string } }>(
    "/public/servers/:serverId/channels",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          keyGenerator: (request: { ip: string }) => request.ip,
        },
      },
    },
    async (request, _reply) => {
      const result = await db
        .select({
          id: channels.id,
          name: channels.name,
          type: channels.type,
          topic: channels.topic,
        })
        .from(channels)
        .where(
          and(
            eq(channels.serverId, request.params.serverId),
            eq(channels.isPublic, true),
          ),
        )
        .orderBy(channels.position);

      return result;
    },
  );

  // GET /public/servers/:serverId/channels/:channelId/messages — read messages (no auth)
  app.get<{
    Params: { serverId: string; channelId: string };
    Querystring: { before?: string; limit?: string };
  }>(
    "/public/servers/:serverId/channels/:channelId/messages",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          keyGenerator: (request: { ip: string }) => request.ip,
        },
      },
    },
    async (request, reply) => {
      // Verify channel exists, belongs to server, and is public
      const [channel] = await db
        .select({ id: channels.id, isPublic: channels.isPublic })
        .from(channels)
        .where(
          and(
            eq(channels.id, request.params.channelId),
            eq(channels.serverId, request.params.serverId),
          ),
        )
        .limit(1);

      if (!channel || !channel.isPublic) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Channel not found", statusCode: 404 },
        });
      }

      const limit = Math.min(
        Math.max(parseInt(request.query.limit ?? "50", 10) || 50, 1),
        100,
      );

      const conditions = [
        eq(messages.channelId, request.params.channelId),
        eq(messages.deleted, false),
      ];
      if (request.query.before) {
        conditions.push(lt(messages.createdAt, new Date(request.query.before)));
      }

      const result = await db
        .select({
          id: messages.id,
          channelId: messages.channelId,
          authorId: messages.authorId,
          content: messages.content,
          attachments: messages.attachments,
          embeds: messages.embeds,
          replyToId: messages.replyToId,
          threadId: messages.threadId,
          editedAt: messages.editedAt,
          deleted: messages.deleted,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(and(...conditions))
        .orderBy(desc(messages.createdAt))
        .limit(limit);

      return result;
    },
  );

  // GET /public/servers/:serverId/channels/:channelId/posts — read forum posts (no auth)
  app.get<{
    Params: { serverId: string; channelId: string };
    Querystring: { before?: string; limit?: string; sort?: string };
  }>(
    "/public/servers/:serverId/channels/:channelId/posts",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          keyGenerator: (request: { ip: string }) => request.ip,
        },
      },
    },
    async (request, reply) => {
      // Verify channel exists, belongs to server, and is public
      const [channel] = await db
        .select({ id: channels.id, isPublic: channels.isPublic })
        .from(channels)
        .where(
          and(
            eq(channels.id, request.params.channelId),
            eq(channels.serverId, request.params.serverId),
          ),
        )
        .limit(1);

      if (!channel || !channel.isPublic) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Channel not found", statusCode: 404 },
        });
      }

      const limit = Math.min(
        Math.max(parseInt(request.query.limit ?? "25", 10) || 25, 1),
        100,
      );

      const conditions = [eq(forumPosts.channelId, request.params.channelId)];
      if (request.query.before) {
        conditions.push(lt(forumPosts.createdAt, new Date(request.query.before)));
      }

      const orderBy =
        request.query.sort === "top"
          ? desc(forumPosts.score)
          : desc(forumPosts.createdAt);

      const rows = await db
        .select({
          id: forumPosts.id,
          channelId: forumPosts.channelId,
          authorId: forumPosts.authorId,
          title: forumPosts.title,
          content: forumPosts.content,
          upvotes: forumPosts.upvotes,
          downvotes: forumPosts.downvotes,
          score: forumPosts.score,
          pinned: forumPosts.pinned,
          locked: forumPosts.locked,
          commentCount: forumPosts.commentCount,
          tags: forumPosts.tags,
          createdAt: forumPosts.createdAt,
          authorUsername: users.username,
          authorDisplayName: users.displayName,
          authorAvatarUrl: users.avatarUrl,
        })
        .from(forumPosts)
        .leftJoin(users, eq(forumPosts.authorId, users.id))
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(limit);

      const posts = rows.map((r) => ({
        id: r.id,
        channelId: r.channelId,
        authorId: r.authorId,
        title: r.title,
        content: r.content,
        upvotes: r.upvotes,
        downvotes: r.downvotes,
        score: r.score,
        pinned: r.pinned,
        locked: r.locked,
        commentCount: r.commentCount,
        tags: r.tags,
        createdAt: r.createdAt,
        author: r.authorUsername
          ? {
              username: r.authorUsername,
              displayName: r.authorDisplayName,
              avatarUrl: r.authorAvatarUrl,
            }
          : undefined,
      }));

      return posts;
    },
  );
}
