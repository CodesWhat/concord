import { eq, and, lt, desc } from "drizzle-orm";
import { db } from "../db.js";
import { messages, users } from "../models/schema.js";
import { generateSnowflake } from "../utils/snowflake.js";
import { hasPermission, Permissions } from "@concord/shared";
import type { ServiceResult } from "@concord/shared";

export async function createMessage(
  channelId: string,
  authorId: string,
  content: string,
  replyToId?: string,
): Promise<ServiceResult<MessageWithAuthor>> {
  const id = BigInt(generateSnowflake());

  const [message] = await db
    .insert(messages)
    .values({
      id,
      channelId,
      authorId,
      content,
      replyToId: replyToId ? BigInt(replyToId) : undefined,
    })
    .returning();

  if (!message) {
    return { data: null, error: { code: "INTERNAL", message: "Failed to create message", statusCode: 500 } };
  }

  // Fetch author info for the response
  const [author] = await db
    .select({ username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, authorId))
    .limit(1);

  return {
    data: {
      id: message.id.toString(),
      channelId: message.channelId,
      authorId: message.authorId,
      content: message.content,
      attachments: message.attachments,
      embeds: message.embeds,
      replyToId: message.replyToId?.toString() ?? null,
      threadId: message.threadId,
      editedAt: message.editedAt,
      deleted: message.deleted,
      createdAt: message.createdAt,
      author: author
        ? { username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl }
        : { username: "unknown", displayName: "Unknown", avatarUrl: null },
    },
    error: null,
  };
}

interface MessageWithAuthor {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  attachments: unknown;
  embeds: unknown;
  replyToId: string | null;
  threadId: string | null;
  editedAt: Date | null;
  deleted: boolean;
  createdAt: Date;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export async function getMessages(
  channelId: string,
  before?: string,
  limit = 50,
): Promise<ServiceResult<MessageWithAuthor[]>> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  const conditions = before
    ? and(eq(messages.channelId, channelId), eq(messages.deleted, false), lt(messages.id, BigInt(before)))
    : and(eq(messages.channelId, channelId), eq(messages.deleted, false));

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
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(messages)
    .innerJoin(users, eq(messages.authorId, users.id))
    .where(conditions)
    .orderBy(desc(messages.id))
    .limit(safeLimit);

  const mapped: MessageWithAuthor[] = result.map((r) => ({
    id: r.id.toString(),
    channelId: r.channelId,
    authorId: r.authorId,
    content: r.content,
    attachments: r.attachments,
    embeds: r.embeds,
    replyToId: r.replyToId?.toString() ?? null,
    threadId: r.threadId,
    editedAt: r.editedAt,
    deleted: r.deleted,
    createdAt: r.createdAt,
    author: {
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    },
  }));

  return { data: mapped, error: null };
}

export async function updateMessage(
  messageId: string,
  authorId: string,
  content: string,
): Promise<ServiceResult<MessageWithAuthor>> {
  // Verify author
  const existing = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, BigInt(messageId)), eq(messages.deleted, false)))
    .limit(1);

  if (existing.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Message not found", statusCode: 404 } };
  }

  if (existing[0]!.authorId !== authorId) {
    return { data: null, error: { code: "FORBIDDEN", message: "Can only edit your own messages", statusCode: 403 } };
  }

  const [updated] = await db
    .update(messages)
    .set({ content, editedAt: new Date() })
    .where(eq(messages.id, BigInt(messageId)))
    .returning();

  const msg = updated!;
  const [author] = await db
    .select({ username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, msg.authorId))
    .limit(1);

  return {
    data: {
      id: msg.id.toString(),
      channelId: msg.channelId,
      authorId: msg.authorId,
      content: msg.content,
      attachments: msg.attachments,
      embeds: msg.embeds,
      replyToId: msg.replyToId?.toString() ?? null,
      threadId: msg.threadId,
      editedAt: msg.editedAt,
      deleted: msg.deleted,
      createdAt: msg.createdAt,
      author: author
        ? { username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl }
        : { username: "unknown", displayName: "Unknown", avatarUrl: null },
    },
    error: null,
  };
}

export async function deleteMessage(
  messageId: string,
  userId: string,
  userPermissions?: number,
): Promise<ServiceResult<{ deleted: true }>> {
  const existing = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, BigInt(messageId)), eq(messages.deleted, false)))
    .limit(1);

  if (existing.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Message not found", statusCode: 404 } };
  }

  const msg = existing[0]!;

  // Author can always delete their own messages.
  // Otherwise need MANAGE_MESSAGES permission.
  if (msg.authorId !== userId) {
    if (!userPermissions || !hasPermission(userPermissions, Permissions.MANAGE_MESSAGES)) {
      return { data: null, error: { code: "FORBIDDEN", message: "Cannot delete this message", statusCode: 403 } };
    }
  }

  // Soft delete
  await db
    .update(messages)
    .set({ deleted: true })
    .where(eq(messages.id, BigInt(messageId)));

  return { data: { deleted: true }, error: null };
}
