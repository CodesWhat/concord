import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db.js";
import { reactions } from "../models/schema.js";
import type { ServiceResult } from "@concord/shared";

export interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
}

function validateEmoji(emoji: string): string | null {
  if (!emoji || emoji.trim().length === 0) {
    return "Emoji cannot be empty";
  }
  if (emoji.length > 32) {
    return "Emoji cannot exceed 32 characters";
  }
  return null;
}

export async function addReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<ServiceResult<ReactionGroup[]>> {
  const validationError = validateEmoji(emoji);
  if (validationError) {
    return {
      data: null,
      error: { code: "BAD_REQUEST", message: validationError, statusCode: 400 },
    };
  }

  try {
    await db
      .insert(reactions)
      .values({
        messageId: BigInt(messageId),
        userId,
        emoji,
      })
      .onConflictDoNothing();
  } catch (err) {
    console.error("[reactions] addReaction insert error:", err);
    return {
      data: null,
      error: { code: "INTERNAL", message: "Failed to add reaction", statusCode: 500 },
    };
  }

  return getReactions(messageId);
}

export async function removeReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<ServiceResult<ReactionGroup[]>> {
  const validationError = validateEmoji(emoji);
  if (validationError) {
    return {
      data: null,
      error: { code: "BAD_REQUEST", message: validationError, statusCode: 400 },
    };
  }

  try {
    await db
      .delete(reactions)
      .where(
        and(
          eq(reactions.messageId, BigInt(messageId)),
          eq(reactions.userId, userId),
          eq(reactions.emoji, emoji),
        ),
      );
  } catch (err) {
    console.error("[reactions] removeReaction delete error:", err);
    return {
      data: null,
      error: { code: "INTERNAL", message: "Failed to remove reaction", statusCode: 500 },
    };
  }

  return getReactions(messageId);
}

export async function getReactions(
  messageId: string,
): Promise<ServiceResult<ReactionGroup[]>> {
  try {
    const rows = await db
      .select({
        emoji: reactions.emoji,
        userId: reactions.userId,
      })
      .from(reactions)
      .where(eq(reactions.messageId, BigInt(messageId)))
      .orderBy(reactions.emoji, reactions.createdAt);

    // Group into emoji -> { count, users }
    const grouped = new Map<string, { userIds: string[] }>();
    for (const row of rows) {
      const existing = grouped.get(row.emoji);
      if (existing) {
        existing.userIds.push(row.userId);
      } else {
        grouped.set(row.emoji, { userIds: [row.userId] });
      }
    }

    const result: ReactionGroup[] = Array.from(grouped.entries()).map(
      ([emoji, data]) => ({
        emoji,
        count: data.userIds.length,
        userIds: data.userIds,
      }),
    );

    return { data: result, error: null };
  } catch (err) {
    console.error("[reactions] getReactions error:", err);
    return {
      data: null,
      error: { code: "INTERNAL", message: "Failed to get reactions", statusCode: 500 },
    };
  }
}

export async function getReactionsBatch(
  messageIds: string[],
): Promise<ServiceResult<Record<string, ReactionGroup[]>>> {
  if (messageIds.length === 0) {
    return { data: {}, error: null };
  }
  try {
    const bigintIds = messageIds.map((id) => BigInt(id));
    const rows = await db
      .select({
        messageId: reactions.messageId,
        emoji: reactions.emoji,
        userId: reactions.userId,
      })
      .from(reactions)
      .where(inArray(reactions.messageId, bigintIds))
      .orderBy(reactions.emoji, reactions.createdAt);

    const result: Record<string, ReactionGroup[]> = {};
    for (const row of rows) {
      const mid = row.messageId.toString();
      if (!result[mid]) result[mid] = [];
      const group = result[mid].find((g) => g.emoji === row.emoji);
      if (group) {
        group.userIds.push(row.userId);
        group.count = group.userIds.length;
      } else {
        result[mid].push({ emoji: row.emoji, count: 1, userIds: [row.userId] });
      }
    }
    return { data: result, error: null };
  } catch (err) {
    console.error("[reactions] getReactionsBatch error:", err);
    return {
      data: null,
      error: { code: "INTERNAL", message: "Failed to get reactions", statusCode: 500 },
    };
  }
}
