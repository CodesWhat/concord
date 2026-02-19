import { eq, and, lt, desc, sql, inArray } from "drizzle-orm";
import { db } from "../db.js";
import {
  dmChannels,
  dmParticipants,
  dmMessages,
  users,
} from "../models/schema.js";
import { generateSnowflake } from "../utils/snowflake.js";
import type { ServiceResult } from "@concord/shared";

export interface DmChannelWithParticipant {
  id: string;
  createdAt: Date;
  participant: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    status: string;
  };
  lastMessage?: {
    content: string;
    createdAt: Date;
  };
}

export interface DmMessageWithAuthor {
  id: string;
  dmChannelId: string;
  authorId: string;
  content: string;
  attachments: unknown;
  editedAt: Date | null;
  createdAt: Date;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

/**
 * Find an existing 1:1 DM channel between two users or create a new one.
 */
export async function getOrCreateDmChannel(
  userId1: string,
  userId2: string,
): Promise<ServiceResult<{ id: string }>> {
  try {
    const result = await db.transaction(async (tx) => {
      // Verify recipient exists
      const recipientExists = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId2))
        .limit(1);

      if (recipientExists.length === 0) {
        return { data: null, error: { code: "NOT_FOUND", message: "Recipient user not found", statusCode: 404 } as const };
      }

      // Find dm channels where user1 is a participant
      const user1Channels = await tx
        .select({ dmChannelId: dmParticipants.dmChannelId })
        .from(dmParticipants)
        .where(eq(dmParticipants.userId, userId1));

      if (user1Channels.length > 0) {
        const channelIds = user1Channels.map((r) => r.dmChannelId);
        const sharedChannels = await tx
          .select({ dmChannelId: dmParticipants.dmChannelId })
          .from(dmParticipants)
          .where(
            and(
              inArray(dmParticipants.dmChannelId, channelIds),
              eq(dmParticipants.userId, userId2),
            ),
          )
          .limit(1);

        if (sharedChannels.length > 0 && sharedChannels[0]) {
          return { data: { id: sharedChannels[0].dmChannelId }, error: null };
        }
      }

      // Create a new DM channel
      const [channel] = await tx
        .insert(dmChannels)
        .values({})
        .returning({ id: dmChannels.id });

      if (!channel) {
        return {
          data: null,
          error: { code: "INTERNAL", message: "Failed to create DM channel", statusCode: 500 } as const,
        };
      }

      await tx.insert(dmParticipants).values([
        { dmChannelId: channel.id, userId: userId1 },
        { dmChannelId: channel.id, userId: userId2 },
      ]);

      return { data: { id: channel.id }, error: null };
    });

    return result;
  } catch (err) {
    console.error("[DMs] getOrCreateDmChannel error:", err);
    return {
      data: null,
      error: { code: "INTERNAL", message: "Internal error", statusCode: 500 },
    };
  }
}

/**
 * List all DM channels for a user with other participant info and last message.
 */
export async function getDmChannels(
  userId: string,
): Promise<ServiceResult<DmChannelWithParticipant[]>> {
  try {
    // Get all DM channels the user is part of
    const channelRows = await db
      .select({ id: dmChannels.id, createdAt: dmChannels.createdAt })
      .from(dmChannels)
      .innerJoin(dmParticipants, eq(dmParticipants.dmChannelId, dmChannels.id))
      .where(eq(dmParticipants.userId, userId));

    if (channelRows.length === 0) {
      return { data: [], error: null };
    }

    const channelIds = channelRows.map((r) => r.id);

    // Get other participants for each channel (all participants except the current user)
    const participantRows = await db
      .select({
        dmChannelId: dmParticipants.dmChannelId,
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        status: users.status,
      })
      .from(dmParticipants)
      .innerJoin(users, eq(users.id, dmParticipants.userId))
      .where(
        and(
          inArray(dmParticipants.dmChannelId, channelIds),
          sql`${dmParticipants.userId} != ${userId}`,
        ),
      );

    // Get last message per channel efficiently using DISTINCT ON
    const lastMessageRows = channelIds.length > 0
      ? await db.execute(sql`
        SELECT DISTINCT ON (dm_channel_id) dm_channel_id, content, created_at
        FROM dm_messages
        WHERE dm_channel_id IN (${sql.join(channelIds.map(id => sql`${id}`), sql`, `)})
        ORDER BY dm_channel_id, id DESC
      `)
      : [];

    const lastMessageMap = new Map<string, { content: string; createdAt: Date }>();
    for (const m of lastMessageRows as any[]) {
      lastMessageMap.set(m.dm_channel_id, {
        content: m.content,
        createdAt: new Date(m.created_at),
      });
    }

    const participantMap = new Map<string, (typeof participantRows)[0]>();
    for (const p of participantRows) {
      participantMap.set(p.dmChannelId, p);
    }

    const result: DmChannelWithParticipant[] = [];
    for (const ch of channelRows) {
      const participant = participantMap.get(ch.id);
      if (!participant) continue;
      result.push({
        id: ch.id,
        createdAt: ch.createdAt,
        participant: {
          id: participant.userId,
          username: participant.username,
          displayName: participant.displayName,
          avatarUrl: participant.avatarUrl,
          status: participant.status,
        },
        lastMessage: lastMessageMap.get(ch.id),
      });
    }

    result.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt?.getTime() ?? a.createdAt.getTime();
      const bTime = b.lastMessage?.createdAt?.getTime() ?? b.createdAt.getTime();
      return bTime - aTime;
    });

    return { data: result, error: null };
  } catch (err) {
    console.error("[DMs] getDmChannels error:", err);
    return {
      data: null,
      error: { code: "INTERNAL", message: "Internal error", statusCode: 500 },
    };
  }
}

/**
 * Check if a user is a participant in a DM channel.
 */
async function isParticipant(
  dmChannelId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ dmChannelId: dmParticipants.dmChannelId })
    .from(dmParticipants)
    .where(
      and(
        eq(dmParticipants.dmChannelId, dmChannelId),
        eq(dmParticipants.userId, userId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Get messages for a DM channel. User must be a participant.
 */
export async function getDmMessages(
  dmChannelId: string,
  userId: string,
  before?: string,
  limit = 50,
): Promise<ServiceResult<DmMessageWithAuthor[]>> {
  try {
    const participant = await isParticipant(dmChannelId, userId);
    if (!participant) {
      return {
        data: null,
        error: { code: "FORBIDDEN", message: "Not a participant of this DM", statusCode: 403 },
      };
    }

    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const conditions = before
      ? and(
          eq(dmMessages.dmChannelId, dmChannelId),
          lt(dmMessages.id, BigInt(before)),
        )
      : eq(dmMessages.dmChannelId, dmChannelId);

    const rows = await db
      .select({
        id: dmMessages.id,
        dmChannelId: dmMessages.dmChannelId,
        authorId: dmMessages.authorId,
        content: dmMessages.content,
        attachments: dmMessages.attachments,
        editedAt: dmMessages.editedAt,
        createdAt: dmMessages.createdAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(dmMessages)
      .innerJoin(users, eq(dmMessages.authorId, users.id))
      .where(conditions)
      .orderBy(desc(dmMessages.id))
      .limit(safeLimit);

    const mapped: DmMessageWithAuthor[] = rows.map((r) => ({
      id: r.id.toString(),
      dmChannelId: r.dmChannelId,
      authorId: r.authorId,
      content: r.content,
      attachments: r.attachments,
      editedAt: r.editedAt,
      createdAt: r.createdAt,
      author: {
        username: r.username,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
      },
    }));

    return { data: mapped, error: null };
  } catch (err) {
    console.error("[DMs] getDmMessages error:", err);
    return {
      data: null,
      error: { code: "INTERNAL", message: "Internal error", statusCode: 500 },
    };
  }
}

/**
 * Send a DM message. Author must be a participant.
 */
export async function sendDmMessage(
  dmChannelId: string,
  authorId: string,
  content: string,
): Promise<ServiceResult<DmMessageWithAuthor>> {
  try {
    const participant = await isParticipant(dmChannelId, authorId);
    if (!participant) {
      return {
        data: null,
        error: { code: "FORBIDDEN", message: "Not a participant of this DM", statusCode: 403 },
      };
    }

    const id = BigInt(generateSnowflake());

    const [message] = await db
      .insert(dmMessages)
      .values({ id, dmChannelId, authorId, content })
      .returning();

    if (!message) {
      return {
        data: null,
        error: { code: "INTERNAL", message: "Failed to create message", statusCode: 500 },
      };
    }

    const [author] = await db
      .select({
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, authorId))
      .limit(1);

    return {
      data: {
        id: message.id.toString(),
        dmChannelId: message.dmChannelId,
        authorId: message.authorId,
        content: message.content,
        attachments: message.attachments,
        editedAt: message.editedAt,
        createdAt: message.createdAt,
        author: author
          ? {
              username: author.username,
              displayName: author.displayName,
              avatarUrl: author.avatarUrl,
            }
          : { username: "unknown", displayName: "Unknown", avatarUrl: null },
      },
      error: null,
    };
  } catch (err) {
    console.error("[DMs] sendDmMessage error:", err);
    return {
      data: null,
      error: { code: "INTERNAL", message: "Internal error", statusCode: 500 },
    };
  }
}

/**
 * Get all participants of a DM channel (used to dispatch gateway events).
 */
export async function getDmParticipantIds(
  dmChannelId: string,
): Promise<string[]> {
  try {
    const rows = await db
      .select({ userId: dmParticipants.userId })
      .from(dmParticipants)
      .where(eq(dmParticipants.dmChannelId, dmChannelId));
    return rows.map((r) => r.userId);
  } catch (err) {
    console.error("[DMs] getDmParticipantIds error:", err);
    return [];
  }
}
