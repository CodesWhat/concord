import { eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import { messages, channels, users } from "../models/schema.js";
import type { ServiceResult } from "@concord/shared";

export interface SearchResult {
  id: string;
  channelId: string;
  channelName: string;
  authorId: string;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  content: string;
  createdAt: string;
  highlight: string;
}

export async function searchMessages(
  serverId: string,
  query: string,
  options: {
    channelId?: string;
    authorId?: string;
    before?: string;
    after?: string;
    limit?: number;
    visibleChannelIds?: string[];
  } = {},
): Promise<ServiceResult<SearchResult[]>> {
  const safeLimit = Math.min(Math.max(options.limit ?? 25, 1), 50);

  // If visibleChannelIds was explicitly provided but is empty, user can't see any channels
  if (options.visibleChannelIds && options.visibleChannelIds.length === 0) {
    return { data: [], error: null };
  }

  try {
    const tsquery = sql`plainto_tsquery('english', ${query})`;

    // Build conditions array as raw SQL fragments
    const conditions: ReturnType<typeof sql>[] = [
      sql`${messages.deleted} = false`,
      sql`${channels.serverId} = ${serverId}`,
      sql`${messages}.search_vector @@ ${tsquery}`,
    ];

    if (options.channelId) {
      conditions.push(sql`${messages.channelId} = ${options.channelId}`);
    }

    if (options.authorId) {
      conditions.push(sql`${messages.authorId} = ${options.authorId}`);
    }

    if (options.before) {
      conditions.push(sql`${messages.createdAt} < ${new Date(options.before)}`);
    }

    if (options.after) {
      conditions.push(sql`${messages.createdAt} > ${new Date(options.after)}`);
    }

    if (options.visibleChannelIds && options.visibleChannelIds.length > 0) {
      conditions.push(
        sql`${messages.channelId} IN (${sql.join(options.visibleChannelIds.map(id => sql`${id}`), sql`, `)})`,
      );
    }

    const whereClause = conditions.reduce(
      (acc, cond) => sql`${acc} AND ${cond}`,
    );

    const rows = await db
      .select({
        id: messages.id,
        channelId: messages.channelId,
        channelName: channels.name,
        authorId: messages.authorId,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        content: messages.content,
        createdAt: messages.createdAt,
        highlight: sql<string>`ts_headline('english', ${messages.content}, ${tsquery}, 'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15')`,
      })
      .from(messages)
      .innerJoin(channels, eq(messages.channelId, channels.id))
      .innerJoin(users, eq(messages.authorId, users.id))
      .where(whereClause)
      .orderBy(sql`ts_rank_cd(${messages}.search_vector, ${tsquery}) DESC`)
      .limit(safeLimit);

    const results: SearchResult[] = rows.map((row) => ({
      id: row.id.toString(),
      channelId: row.channelId,
      channelName: row.channelName,
      authorId: row.authorId,
      author: {
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
      },
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      highlight: row.highlight,
    }));

    return { data: results, error: null };
  } catch (err) {
    console.error("[search] searchMessages error:", err);
    return {
      data: null,
      error: {
        code: "INTERNAL_ERROR",
        message: "Search failed",
        statusCode: 500,
      },
    };
  }
}
