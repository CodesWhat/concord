import { eq, and, desc, lt } from "drizzle-orm";
import { db } from "../db.js";
import { threads, messages, users } from "../models/schema.js";
import type { ServiceResult } from "@concord/shared";

interface ThreadData {
  id: string;
  parentMessageId: string;
  channelId: string;
  name: string;
  archived: boolean;
  autoArchiveAfter: number | null;
  messageCount: number;
  createdAt: Date;
}

interface ThreadMessageWithAuthor {
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

export async function createThread(
  channelId: string,
  parentMessageId: string,
  name: string,
  _userId: string,
): Promise<ServiceResult<ThreadData>> {
  if (!name || name.trim().length === 0) {
    return { data: null, error: { code: "BAD_REQUEST", message: "Thread name is required", statusCode: 400 } };
  }
  if (name.length > 100) {
    return { data: null, error: { code: "BAD_REQUEST", message: "Thread name too long (max 100 characters)", statusCode: 400 } };
  }

  // Verify parent message exists and belongs to the channel
  const [parentMsg] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.id, BigInt(parentMessageId)),
        eq(messages.channelId, channelId),
        eq(messages.deleted, false),
      ),
    )
    .limit(1);

  if (!parentMsg) {
    return { data: null, error: { code: "NOT_FOUND", message: "Parent message not found in this channel", statusCode: 404 } };
  }

  // Check if a thread already exists for this message
  if (parentMsg.threadId) {
    return { data: null, error: { code: "CONFLICT", message: "A thread already exists on this message", statusCode: 409 } };
  }

  // Create thread
  const [thread] = await db
    .insert(threads)
    .values({
      channelId,
      parentMessageId: BigInt(parentMessageId),
      name: name.trim(),
    })
    .returning();

  if (!thread) {
    return { data: null, error: { code: "INTERNAL", message: "Failed to create thread", statusCode: 500 } };
  }

  // Update parent message to reference the thread
  await db
    .update(messages)
    .set({ threadId: thread.id })
    .where(eq(messages.id, BigInt(parentMessageId)));

  return {
    data: {
      id: thread.id,
      parentMessageId: thread.parentMessageId.toString(),
      channelId: thread.channelId,
      name: thread.name,
      archived: thread.archived,
      autoArchiveAfter: thread.autoArchiveAfter,
      messageCount: thread.messageCount,
      createdAt: thread.createdAt,
    },
    error: null,
  };
}

export async function getThread(
  threadId: string,
): Promise<ServiceResult<ThreadData>> {
  const [thread] = await db
    .select()
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);

  if (!thread) {
    return { data: null, error: { code: "NOT_FOUND", message: "Thread not found", statusCode: 404 } };
  }

  return {
    data: {
      id: thread.id,
      parentMessageId: thread.parentMessageId.toString(),
      channelId: thread.channelId,
      name: thread.name,
      archived: thread.archived,
      autoArchiveAfter: thread.autoArchiveAfter,
      messageCount: thread.messageCount,
      createdAt: thread.createdAt,
    },
    error: null,
  };
}

export async function getChannelThreads(
  channelId: string,
  includeArchived = false,
): Promise<ServiceResult<ThreadData[]>> {
  const conditions = includeArchived
    ? eq(threads.channelId, channelId)
    : and(eq(threads.channelId, channelId), eq(threads.archived, false));

  const result = await db
    .select()
    .from(threads)
    .where(conditions)
    .orderBy(desc(threads.createdAt));

  const mapped: ThreadData[] = result.map((t) => ({
    id: t.id,
    parentMessageId: t.parentMessageId.toString(),
    channelId: t.channelId,
    name: t.name,
    archived: t.archived,
    autoArchiveAfter: t.autoArchiveAfter,
    messageCount: t.messageCount,
    createdAt: t.createdAt,
  }));

  return { data: mapped, error: null };
}

export async function getThreadMessages(
  threadId: string,
  before?: string,
  limit = 50,
): Promise<ServiceResult<ThreadMessageWithAuthor[]>> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  const conditions = before
    ? and(
        eq(messages.threadId, threadId),
        eq(messages.deleted, false),
        lt(messages.id, BigInt(before)),
      )
    : and(eq(messages.threadId, threadId), eq(messages.deleted, false));

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

  const mapped: ThreadMessageWithAuthor[] = result.map((r) => ({
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

export async function sendThreadMessage(
  threadId: string,
  authorId: string,
  content: string,
  replyToId?: string,
): Promise<ServiceResult<ThreadMessageWithAuthor>> {
  // Verify thread exists and is not archived
  const [thread] = await db
    .select()
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);

  if (!thread) {
    return { data: null, error: { code: "NOT_FOUND", message: "Thread not found", statusCode: 404 } };
  }

  if (thread.archived) {
    return { data: null, error: { code: "FORBIDDEN", message: "Cannot send messages in an archived thread", statusCode: 403 } };
  }

  const { generateSnowflake } = await import("../utils/snowflake.js");
  const id = BigInt(generateSnowflake());

  const [message] = await db
    .insert(messages)
    .values({
      id,
      channelId: thread.channelId,
      authorId,
      content,
      threadId,
      replyToId: replyToId ? BigInt(replyToId) : undefined,
    })
    .returning();

  if (!message) {
    return { data: null, error: { code: "INTERNAL", message: "Failed to create message", statusCode: 500 } };
  }

  // Increment thread message count
  await db
    .update(threads)
    .set({ messageCount: thread.messageCount + 1 })
    .where(eq(threads.id, threadId));

  // Fetch author info
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

export async function updateThread(
  threadId: string,
  updates: { name?: string; archived?: boolean },
): Promise<ServiceResult<ThreadData>> {
  const [existing] = await db
    .select()
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);

  if (!existing) {
    return { data: null, error: { code: "NOT_FOUND", message: "Thread not found", statusCode: 404 } };
  }

  const setValues: Record<string, unknown> = {};

  if (updates.name !== undefined) {
    if (updates.name.trim().length === 0) {
      return { data: null, error: { code: "BAD_REQUEST", message: "Thread name cannot be empty", statusCode: 400 } };
    }
    if (updates.name.length > 100) {
      return { data: null, error: { code: "BAD_REQUEST", message: "Thread name too long (max 100 characters)", statusCode: 400 } };
    }
    setValues.name = updates.name.trim();
  }

  if (updates.archived !== undefined) {
    setValues.archived = updates.archived;
  }

  if (Object.keys(setValues).length === 0) {
    return { data: null, error: { code: "BAD_REQUEST", message: "No valid fields to update", statusCode: 400 } };
  }

  const [updated] = await db
    .update(threads)
    .set(setValues)
    .where(eq(threads.id, threadId))
    .returning();

  const thread = updated!;

  return {
    data: {
      id: thread.id,
      parentMessageId: thread.parentMessageId.toString(),
      channelId: thread.channelId,
      name: thread.name,
      archived: thread.archived,
      autoArchiveAfter: thread.autoArchiveAfter,
      messageCount: thread.messageCount,
      createdAt: thread.createdAt,
    },
    error: null,
  };
}
