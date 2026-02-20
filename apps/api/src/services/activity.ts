import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { serverMembers } from "../models/schema.js";
import { eq } from "drizzle-orm";

interface ActivityItem {
  type: "mention" | "reply" | "reaction";
  messageId: string;
  channelId: string;
  channelName: string;
  serverId: string;
  content: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  emoji?: string;
  createdAt: string;
}

export async function getActivity(
  userId: string,
  options: {
    type?: "mention" | "reply" | "reaction";
    before?: string;
    limit?: number;
  } = {},
): Promise<ActivityItem[]> {
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);

  // Get user's server IDs for scoping
  const memberships = await db
    .select({ serverId: serverMembers.serverId })
    .from(serverMembers)
    .where(eq(serverMembers.userId, userId));

  const serverIds = memberships.map((m) => m.serverId);
  if (serverIds.length === 0) return [];

  const items: ActivityItem[] = [];

  // Mentions: messages containing <@userId> in servers the user belongs to
  if (!options.type || options.type === "mention") {
    const mentionPattern = `%<@${userId}>%`;
    const beforeFilter = options.before
      ? sql`AND m.id < ${BigInt(options.before)}`
      : sql``;

    const mentionRows = await db.execute(sql`
      SELECT m.id, m.channel_id, m.content, m.created_at, m.author_id,
             u.username, u.display_name, u.avatar_url,
             c.name AS channel_name, c.server_id
      FROM messages m
      JOIN users u ON u.id = m.author_id
      JOIN channels c ON c.id = m.channel_id
      WHERE m.content LIKE ${mentionPattern}
        AND m.deleted = false
        AND m.author_id != ${userId}
        AND c.server_id = ANY(${serverIds})
        ${beforeFilter}
      ORDER BY m.id DESC
      LIMIT ${limit}
    `);

    for (const row of mentionRows as any[]) {
      items.push({
        type: "mention",
        messageId: String(row.id),
        channelId: row.channel_id,
        channelName: row.channel_name,
        serverId: row.server_id,
        content: row.content,
        author: {
          id: row.author_id,
          username: row.username,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
        },
        createdAt: new Date(row.created_at).toISOString(),
      });
    }
  }

  // Replies: messages that reply to one of the user's messages
  if (!options.type || options.type === "reply") {
    const beforeFilter = options.before
      ? sql`AND m.id < ${BigInt(options.before)}`
      : sql``;

    const replyRows = await db.execute(sql`
      SELECT m.id, m.channel_id, m.content, m.created_at, m.author_id,
             u.username, u.display_name, u.avatar_url,
             c.name AS channel_name, c.server_id
      FROM messages m
      JOIN users u ON u.id = m.author_id
      JOIN channels c ON c.id = m.channel_id
      WHERE m.reply_to_id IN (
        SELECT id FROM messages WHERE author_id = ${userId}
      )
        AND m.author_id != ${userId}
        AND m.deleted = false
        AND c.server_id = ANY(${serverIds})
        ${beforeFilter}
      ORDER BY m.id DESC
      LIMIT ${limit}
    `);

    for (const row of replyRows as any[]) {
      items.push({
        type: "reply",
        messageId: String(row.id),
        channelId: row.channel_id,
        channelName: row.channel_name,
        serverId: row.server_id,
        content: row.content,
        author: {
          id: row.author_id,
          username: row.username,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
        },
        createdAt: new Date(row.created_at).toISOString(),
      });
    }
  }

  // Reactions: reactions on the user's messages by other users
  if (!options.type || options.type === "reaction") {
    const reactionRows = await db.execute(sql`
      SELECT r.emoji, r.created_at, r.user_id AS reactor_id,
             m.id AS message_id, m.channel_id, m.content,
             u.username, u.display_name, u.avatar_url,
             c.name AS channel_name, c.server_id
      FROM reactions r
      JOIN messages m ON m.id = r.message_id
      JOIN users u ON u.id = r.user_id
      JOIN channels c ON c.id = m.channel_id
      WHERE m.author_id = ${userId}
        AND r.user_id != ${userId}
        AND c.server_id = ANY(${serverIds})
      ORDER BY r.created_at DESC
      LIMIT ${limit}
    `);

    for (const row of reactionRows as any[]) {
      items.push({
        type: "reaction",
        messageId: String(row.message_id),
        channelId: row.channel_id,
        channelName: row.channel_name,
        serverId: row.server_id,
        content: row.content,
        emoji: row.emoji,
        author: {
          id: row.reactor_id,
          username: row.username,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
        },
        createdAt: new Date(row.created_at).toISOString(),
      });
    }
  }

  // Sort all items by createdAt descending, then take the limit
  items.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return items.slice(0, limit);
}
