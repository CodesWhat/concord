import { eq, and, sql, desc, lt } from "drizzle-orm";
import { db } from "../db.js";
import {
  communities,
  subscriptions,
  servers,
  channels,
  serverMembers,
  roles,
  forumPosts,
  users,
} from "../models/schema.js";
import { redis } from "../redis.js";
import { resolvePermissions } from "../middleware/permissions.js";
import { Permissions, hasPermission } from "@concord/shared";
import type {
  ServiceResult,
  CommunityWithChannel,
  PublicCommunityDetail,
  FeedPost,
  PaginatedResponse,
} from "@concord/shared";

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
const RESERVED_SLUGS = new Set([
  "admin", "api", "search", "explore", "create", "submit",
  "settings", "login", "register", "about", "help", "terms",
  "privacy", "mod", "null", "undefined",
]);

function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug) && !RESERVED_SLUGS.has(slug);
}

export async function createCommunity(
  userId: string,
  data: {
    name: string;
    slug: string;
    description?: string;
    category?: string;
    tags?: string[];
    rules?: { title: string; body: string }[];
  },
): Promise<ServiceResult<CommunityWithChannel>> {
  // Validate name
  if (!data.name || data.name.trim().length < 2 || data.name.length > 100) {
    return {
      data: null,
      error: { code: "BAD_REQUEST", message: "Name must be between 2 and 100 characters", statusCode: 400 },
    };
  }

  // Validate slug
  if (!isValidSlug(data.slug)) {
    return {
      data: null,
      error: { code: "BAD_REQUEST", message: "Slug must be 3-50 characters, lowercase alphanumeric and hyphens only", statusCode: 400 },
    };
  }

  // Validate tags
  const tags = (data.tags ?? []).slice(0, 10).map((t) => t.trim().toLowerCase().slice(0, 30));

  // Validate rules
  const rules = (data.rules ?? []).slice(0, 15).map((r) => ({
    title: r.title.slice(0, 100),
    body: r.body.slice(0, 500),
  }));

  // Check for slug conflict
  const existing = await db
    .select({ serverId: communities.serverId })
    .from(communities)
    .where(eq(communities.slug, data.slug))
    .limit(1);

  if (existing.length > 0) {
    return {
      data: null,
      error: { code: "CONFLICT", message: "A community with this slug already exists", statusCode: 409 },
    };
  }

  // Execute compound operation in transaction
  const result = await db.transaction(async (tx) => {
    // 1. Create server
    const [server] = await tx
      .insert(servers)
      .values({
        name: data.name.trim(),
        ownerId: userId,
        description: data.description ?? null,
      })
      .returning();

    if (!server) throw new Error("Failed to create server");

    // 2. Create @everyone role with default permissions
    await tx.insert(roles).values({
      serverId: server.id,
      name: "@everyone",
      permissions: BigInt(
        Permissions.READ_MESSAGES |
        Permissions.SEND_MESSAGES |
        Permissions.ADD_REACTIONS |
        Permissions.EMBED_LINKS |
        Permissions.ATTACH_FILES,
      ),
      position: 0,
    });

    // 3. Create forum channel
    const [channel] = await tx
      .insert(channels)
      .values({
        serverId: server.id,
        name: "posts",
        type: "forum",
      })
      .returning();

    if (!channel) throw new Error("Failed to create channel");

    // 4. Create community record
    const [community] = await tx
      .insert(communities)
      .values({
        serverId: server.id,
        slug: data.slug,
        description: data.description ?? null,
        category: data.category ?? null,
        tags,
        rules,
        subscriberCount: 1,
      })
      .returning();

    if (!community) throw new Error("Failed to create community");

    // 5. Add creator as server member
    await tx.insert(serverMembers).values({
      userId,
      serverId: server.id,
    });

    // 6. Add creator as subscriber
    await tx.insert(subscriptions).values({
      userId,
      serverId: server.id,
    });

    return {
      serverId: server.id,
      slug: community.slug,
      name: server.name,
      description: community.description,
      category: community.category,
      tags: community.tags as string[],
      bannerUrl: community.bannerUrl,
      subscriberCount: community.subscriberCount,
      iconUrl: server.iconUrl,
      createdAt: community.createdAt.toISOString(),
      forumChannelId: channel.id,
      rules: community.rules as { title: string; body: string }[],
    };
  });

  return { data: result, error: null };
}

export async function updateCommunity(
  slug: string,
  userId: string,
  updates: {
    description?: string;
    category?: string;
    tags?: string[];
    rules?: { title: string; body: string }[];
    bannerUrl?: string;
    isPublic?: boolean;
  },
): Promise<ServiceResult<PublicCommunityDetail>> {
  // Resolve slug -> community -> server
  const communityResult = await db
    .select({
      serverId: communities.serverId,
    })
    .from(communities)
    .where(eq(communities.slug, slug))
    .limit(1);

  if (communityResult.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Community not found", statusCode: 404 } };
  }

  const serverId = communityResult[0]!.serverId;

  // Check permissions
  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (server?.ownerId !== userId) {
    const perms = await resolvePermissions(userId, serverId);
    if (!hasPermission(perms, Permissions.MANAGE_SERVER)) {
      return {
        data: null,
        error: { code: "FORBIDDEN", message: "Only the community owner can update community settings", statusCode: 403 },
      };
    }
  }

  // Build update values
  const setValues: Record<string, unknown> = {};
  if (updates.description !== undefined) setValues["description"] = updates.description.slice(0, 500);
  if (updates.category !== undefined) setValues["category"] = updates.category;
  if (updates.tags !== undefined) {
    setValues["tags"] = updates.tags.slice(0, 10).map((t) => t.trim().toLowerCase().slice(0, 30));
  }
  if (updates.rules !== undefined) {
    setValues["rules"] = updates.rules.slice(0, 15).map((r) => ({
      title: r.title.slice(0, 100),
      body: r.body.slice(0, 500),
    }));
  }
  if (updates.bannerUrl !== undefined) setValues["bannerUrl"] = updates.bannerUrl;
  if (updates.isPublic !== undefined) setValues["isPublic"] = updates.isPublic;

  if (Object.keys(setValues).length > 0) {
    await db
      .update(communities)
      .set(setValues)
      .where(eq(communities.slug, slug));
  }

  // Invalidate cache
  await redis.del(`community:${slug}`);

  // Return updated detail using the public service
  const { getCommunityBySlug } = await import("./public.js");
  return getCommunityBySlug(slug);
}

export async function subscribe(
  slug: string,
  userId: string,
): Promise<ServiceResult<{ subscribed: boolean; subscriberCount: number }>> {
  // Resolve slug -> community
  const communityResult = await db
    .select({ serverId: communities.serverId, isPublic: communities.isPublic })
    .from(communities)
    .where(eq(communities.slug, slug))
    .limit(1);

  if (communityResult.length === 0 || !communityResult[0]!.isPublic) {
    return { data: null, error: { code: "NOT_FOUND", message: "Community not found", statusCode: 404 } };
  }

  const serverId = communityResult[0]!.serverId;

  // Check if already subscribed
  const existingSub = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.serverId, serverId)))
    .limit(1);

  if (existingSub.length > 0) {
    return {
      data: null,
      error: { code: "CONFLICT", message: "Already subscribed to this community", statusCode: 409 },
    };
  }

  // Insert subscription
  await db.insert(subscriptions).values({ userId, serverId });

  // Increment subscriber count atomically
  await db
    .update(communities)
    .set({ subscriberCount: sql`${communities.subscriberCount} + 1` })
    .where(eq(communities.serverId, serverId));

  // Also add as server member if not already
  const existingMember = await db
    .select({ userId: serverMembers.userId })
    .from(serverMembers)
    .where(and(eq(serverMembers.userId, userId), eq(serverMembers.serverId, serverId)))
    .limit(1);

  if (existingMember.length === 0) {
    await db.insert(serverMembers).values({ userId, serverId });
  }

  // Get updated count
  const [updated] = await db
    .select({ subscriberCount: communities.subscriberCount })
    .from(communities)
    .where(eq(communities.serverId, serverId))
    .limit(1);

  // Invalidate cache
  await redis.del(`community:${slug}`);

  return {
    data: {
      subscribed: true,
      subscriberCount: updated?.subscriberCount ?? 0,
    },
    error: null,
  };
}

export async function unsubscribe(
  slug: string,
  userId: string,
): Promise<ServiceResult<{ subscribed: boolean; subscriberCount: number }>> {
  // Resolve slug -> community
  const communityResult = await db
    .select({ serverId: communities.serverId })
    .from(communities)
    .where(eq(communities.slug, slug))
    .limit(1);

  if (communityResult.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Community not found", statusCode: 404 } };
  }

  const serverId = communityResult[0]!.serverId;

  // Delete subscription
  const deleted = await db
    .delete(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.serverId, serverId)))
    .returning();

  if (deleted.length === 0) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Not subscribed to this community", statusCode: 404 },
    };
  }

  // Decrement subscriber count atomically
  await db
    .update(communities)
    .set({ subscriberCount: sql`GREATEST(${communities.subscriberCount} - 1, 0)` })
    .where(eq(communities.serverId, serverId));

  // Get updated count
  const [updated] = await db
    .select({ subscriberCount: communities.subscriberCount })
    .from(communities)
    .where(eq(communities.serverId, serverId))
    .limit(1);

  // Invalidate cache
  await redis.del(`community:${slug}`);

  return {
    data: {
      subscribed: false,
      subscriberCount: updated?.subscriberCount ?? 0,
    },
    error: null,
  };
}

export async function getUserFeed(
  userId: string,
  options: {
    sort?: "hot" | "new" | "top";
    before?: string;
    limit?: number;
    period?: "day" | "week" | "month" | "year" | "all";
  },
): Promise<ServiceResult<PaginatedResponse<FeedPost>>> {
  const safeLimit = Math.min(Math.max(options.limit ?? 25, 1), 50);
  const sort = options.sort ?? "hot";

  const conditions = [eq(communities.isPublic, true)];

  if (options.before) {
    conditions.push(lt(forumPosts.id, BigInt(options.before)));
  }

  if (sort === "top" && options.period && options.period !== "all") {
    const intervals: Record<string, string> = {
      day: "1 day",
      week: "7 days",
      month: "30 days",
      year: "365 days",
    };
    const interval = intervals[options.period];
    if (interval) {
      conditions.push(sql`${forumPosts.createdAt} > NOW() - INTERVAL '${sql.raw(interval)}'`);
    }
  }

  let orderBy;
  switch (sort) {
    case "new":
      orderBy = [desc(forumPosts.createdAt)];
      break;
    case "top":
      orderBy = [desc(forumPosts.score)];
      break;
    case "hot":
    default:
      orderBy = [sql`hot_rank(${forumPosts.score}, ${forumPosts.createdAt}) DESC`];
      break;
  }

  const result = await db
    .select({
      id: forumPosts.id,
      title: forumPosts.title,
      content: forumPosts.content,
      upvotes: forumPosts.upvotes,
      downvotes: forumPosts.downvotes,
      score: forumPosts.score,
      pinned: forumPosts.pinned,
      locked: forumPosts.locked,
      commentCount: forumPosts.commentCount,
      tags: forumPosts.tags,
      postCreatedAt: forumPosts.createdAt,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      slug: communities.slug,
      serverName: servers.name,
      serverIconUrl: servers.iconUrl,
      userVote: sql<number | null>`(SELECT value FROM forum_votes WHERE post_id = ${forumPosts.id} AND user_id = ${userId})`,
    })
    .from(forumPosts)
    .innerJoin(channels, eq(forumPosts.channelId, channels.id))
    .innerJoin(communities, eq(channels.serverId, communities.serverId))
    .innerJoin(servers, eq(communities.serverId, servers.id))
    .innerJoin(subscriptions, and(
      eq(subscriptions.serverId, communities.serverId),
      eq(subscriptions.userId, userId),
    ))
    .innerJoin(users, eq(forumPosts.authorId, users.id))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(safeLimit);

  const items: FeedPost[] = result.map((r) => ({
    id: r.id.toString(),
    title: r.title,
    content: r.content.length > 300 ? r.content.slice(0, 300) + "..." : r.content,
    upvotes: r.upvotes,
    downvotes: r.downvotes,
    score: r.score,
    pinned: r.pinned,
    locked: r.locked,
    commentCount: r.commentCount,
    tags: r.tags as string[],
    createdAt: r.postCreatedAt.toISOString(),
    author: {
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    },
    community: {
      slug: r.slug,
      name: r.serverName,
      iconUrl: r.serverIconUrl,
    },
    userVote: r.userVote ?? null,
  }));

  const nextCursor = items.length === safeLimit ? items[items.length - 1]!.id : null;

  return { data: { items, nextCursor }, error: null };
}
