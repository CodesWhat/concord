import { eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import { channelReadState } from "../models/schema.js";
import type { ServiceResult } from "@concord/shared";

interface ReadStateRow {
  channelId: string;
  lastReadMessageId: string | null;
  mentionCount: number;
}

export async function markAsRead(
  userId: string,
  channelId: string,
  messageId: string,
): Promise<ServiceResult<ReadStateRow>> {
  const [row] = await db
    .insert(channelReadState)
    .values({
      userId,
      channelId,
      lastReadMessageId: BigInt(messageId),
      mentionCount: 0,
    })
    .onConflictDoUpdate({
      target: [channelReadState.userId, channelReadState.channelId],
      set: {
        lastReadMessageId: BigInt(messageId),
        mentionCount: 0,
      },
    })
    .returning();

  if (!row) {
    return {
      data: null,
      error: { code: "INTERNAL", message: "Failed to update read state", statusCode: 500 },
    };
  }

  return {
    data: {
      channelId: row.channelId,
      lastReadMessageId: row.lastReadMessageId?.toString() ?? null,
      mentionCount: row.mentionCount,
    },
    error: null,
  };
}

export async function getUserReadStates(
  userId: string,
): Promise<ReadStateRow[]> {
  const rows = await db
    .select({
      channelId: channelReadState.channelId,
      lastReadMessageId: channelReadState.lastReadMessageId,
      mentionCount: channelReadState.mentionCount,
    })
    .from(channelReadState)
    .where(eq(channelReadState.userId, userId));

  return rows.map((r) => ({
    channelId: r.channelId,
    lastReadMessageId: r.lastReadMessageId?.toString() ?? null,
    mentionCount: r.mentionCount,
  }));
}

export async function incrementMentionCount(
  userId: string,
  channelId: string,
): Promise<void> {
  await db
    .insert(channelReadState)
    .values({
      userId,
      channelId,
      lastReadMessageId: null,
      mentionCount: 1,
    })
    .onConflictDoUpdate({
      target: [channelReadState.userId, channelReadState.channelId],
      set: {
        mentionCount: sql`${channelReadState.mentionCount} + 1`,
      },
    });
}
