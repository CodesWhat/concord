import { eq, and, desc, sql, lt } from "drizzle-orm";
import { db } from "../db.js";
import {
  communities,
  servers,
  forumPosts,
  channels,
  users,
  messages,
  memberRoles,
  roles,
} from "../models/schema.js";
import { redis } from "../redis.js";
import type {
  ServiceResult,
  PublicCommunity,
  PublicCommunityDetail,
  PublicForumPost,
  PublicTrendingPost,
  PublicPostDetail,
  PublicComment,
  PaginatedResponse,
  SearchResults,
  SEOMetadata,
} from "@concord/shared";

export async function listPublicCommunities(
  options: {
    sort?: "trending" | "new" | "top";
    category?: string;
    before?: string;
    limit?: number;
    q?: string;
  },
): Promise<ServiceResult<PaginatedResponse<PublicCommunity>>> {
  const safeLimit = Math.min(Math.max(options.limit ?? 25, 1), 50);
  const sort = options.sort ?? "trending";

  const cacheKey = !options.before && !options.q
    ? `communities:${sort}:${options.category ?? "all"}:${safeLimit}`
    : null;

  if (cacheKey) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return { data: JSON.parse(cached), error: null };
    }
  }

  const conditions = [eq(communities.isPublic, true)];

  if (options.category) {
    conditions.push(eq(communities.category, options.category));
  }

  if (options.before) {
    conditions.push(lt(communities.serverId, options.before));
  }

  let orderBy;
  switch (sort) {
    case "new":
      orderBy = [desc(communities.createdAt)];
      break;
    case "top":
      orderBy = [desc(communities.subscriberCount)];
      break;
    case "trending":
    default:
      orderBy = [desc(communities.subscriberCount), desc(communities.createdAt)];
      break;
  }

  let query = db
    .select({
      serverId: communities.serverId,
      slug: communities.slug,
      name: servers.name,
      description: communities.description,
      category: communities.category,
      tags: communities.tags,
      bannerUrl: communities.bannerUrl,
      subscriberCount: communities.subscriberCount,
      iconUrl: servers.iconUrl,
      createdAt: communities.createdAt,
    })
    .from(communities)
    .innerJoin(servers, eq(communities.serverId, servers.id))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(safeLimit);

  if (options.q) {
    query = db
      .select({
        serverId: communities.serverId,
        slug: communities.slug,
        name: servers.name,
        description: communities.description,
        category: communities.category,
        tags: communities.tags,
        bannerUrl: communities.bannerUrl,
        subscriberCount: communities.subscriberCount,
        iconUrl: servers.iconUrl,
        createdAt: communities.createdAt,
      })
      .from(communities)
      .innerJoin(servers, eq(communities.serverId, servers.id))
      .where(
        and(
          ...conditions,
          sql`${communities.slug} % ${options.q}`,
        ),
      )
      .orderBy(...orderBy)
      .limit(safeLimit);
  }

  const result = await query;

  const items: PublicCommunity[] = result.map((r) => ({
    serverId: r.serverId,
    slug: r.slug,
    name: r.name,
    description: r.description,
    category: r.category,
    tags: r.tags as string[],
    bannerUrl: r.bannerUrl,
    subscriberCount: r.subscriberCount,
    iconUrl: r.iconUrl,
    createdAt: r.createdAt.toISOString(),
  }));

  const nextCursor = items.length === safeLimit ? items[items.length - 1]!.serverId : null;
  const response: PaginatedResponse<PublicCommunity> = { items, nextCursor };

  if (cacheKey) {
    await redis.set(cacheKey, JSON.stringify(response), "EX", 30);
  }

  return { data: response, error: null };
}

export async function getCommunityBySlug(
  slug: string,
): Promise<ServiceResult<PublicCommunityDetail>> {
  const cacheKey = `community:${slug}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return { data: JSON.parse(cached), error: null };
  }

  const result = await db
    .select({
      serverId: communities.serverId,
      slug: communities.slug,
      description: communities.description,
      category: communities.category,
      tags: communities.tags,
      bannerUrl: communities.bannerUrl,
      rules: communities.rules,
      isPublic: communities.isPublic,
      subscriberCount: communities.subscriberCount,
      createdAt: communities.createdAt,
      name: servers.name,
      iconUrl: servers.iconUrl,
      ownerId: servers.ownerId,
    })
    .from(communities)
    .innerJoin(servers, eq(communities.serverId, servers.id))
    .where(and(eq(communities.slug, slug), eq(communities.isPublic, true)))
    .limit(1);

  if (result.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Community not found", statusCode: 404 } };
  }

  const community = result[0]!;

  // Resolve forum channel
  const forumChannel = await db
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.serverId, community.serverId), eq(channels.type, "forum")))
    .limit(1);

  const forumChannelId = forumChannel[0]?.id ?? "";

  // Resolve owner info
  const [owner] = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, community.ownerId))
    .limit(1);

  // Resolve moderators (users with MANAGE_MESSAGES permission)
  const modRoles = await db
    .select({ id: roles.id })
    .from(roles)
    .where(
      and(
        eq(roles.serverId, community.serverId),
        sql`(${roles.permissions}::int & ${1 << 5}) != 0`,
      ),
    );

  let moderators: { username: string; displayName: string; avatarUrl: string | null }[] = [];
  if (modRoles.length > 0) {
    const modRoleIds = modRoles.map((r) => r.id);
    const modUsers = await db
      .select({
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(memberRoles)
      .innerJoin(users, eq(memberRoles.userId, users.id))
      .where(
        and(
          eq(memberRoles.serverId, community.serverId),
          sql`${memberRoles.roleId} = ANY(${modRoleIds})`,
        ),
      );
    moderators = modUsers;
  }

  const detail: PublicCommunityDetail = {
    serverId: community.serverId,
    slug: community.slug,
    name: community.name,
    description: community.description,
    category: community.category,
    tags: community.tags as string[],
    bannerUrl: community.bannerUrl,
    subscriberCount: community.subscriberCount,
    iconUrl: community.iconUrl,
    createdAt: community.createdAt.toISOString(),
    isPublic: community.isPublic,
    forumChannelId,
    rules: community.rules as { title: string; body: string }[],
    owner: owner
      ? { username: owner.username, displayName: owner.displayName, avatarUrl: owner.avatarUrl }
      : { username: "unknown", displayName: "Unknown", avatarUrl: null },
    moderators,
  };

  await redis.set(cacheKey, JSON.stringify(detail), "EX", 300);

  return { data: detail, error: null };
}

export async function listCommunityPosts(
  slug: string,
  options: {
    sort?: "hot" | "new" | "top";
    before?: string;
    limit?: number;
    period?: "day" | "week" | "month" | "year" | "all";
    tag?: string;
  },
): Promise<ServiceResult<PaginatedResponse<PublicForumPost>>> {
  const safeLimit = Math.min(Math.max(options.limit ?? 25, 1), 50);
  const sort = options.sort ?? "hot";

  // Resolve slug -> server_id
  const communityResult = await db
    .select({ serverId: communities.serverId })
    .from(communities)
    .where(and(eq(communities.slug, slug), eq(communities.isPublic, true)))
    .limit(1);

  if (communityResult.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Community not found", statusCode: 404 } };
  }

  const serverId = communityResult[0]!.serverId;

  // Find forum channel
  const forumChannel = await db
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.serverId, serverId), eq(channels.type, "forum")))
    .limit(1);

  if (forumChannel.length === 0) {
    return { data: { items: [], nextCursor: null }, error: null };
  }

  const channelId = forumChannel[0]!.id;

  // Build conditions
  const conditions = [eq(forumPosts.channelId, channelId)];

  if (options.before) {
    conditions.push(lt(forumPosts.id, BigInt(options.before)));
  }

  if (options.tag) {
    conditions.push(sql`${forumPosts.tags} @> ${JSON.stringify([options.tag])}::jsonb`);
  }

  // Period filtering for 'top' sort
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

  // Get server name for community info
  const [serverInfo] = await db
    .select({ name: servers.name })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

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
      createdAt: forumPosts.createdAt,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(forumPosts)
    .innerJoin(users, eq(forumPosts.authorId, users.id))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(safeLimit);

  const items: PublicForumPost[] = result.map((r) => ({
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
    createdAt: r.createdAt.toISOString(),
    author: {
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    },
    community: {
      slug,
      name: serverInfo?.name ?? slug,
    },
  }));

  const nextCursor = items.length === safeLimit ? items[items.length - 1]!.id : null;

  return { data: { items, nextCursor }, error: null };
}

export async function getPublicPost(
  postId: string,
  options: {
    commentSort?: "top" | "new" | "old";
    commentLimit?: number;
    commentBefore?: string;
  },
): Promise<ServiceResult<PublicPostDetail>> {
  const commentLimit = Math.min(Math.max(options.commentLimit ?? 25, 1), 50);

  // Fetch post
  const postResult = await db
    .select({
      id: forumPosts.id,
      channelId: forumPosts.channelId,
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
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(forumPosts)
    .innerJoin(users, eq(forumPosts.authorId, users.id))
    .where(eq(forumPosts.id, BigInt(postId)))
    .limit(1);

  if (postResult.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Post not found", statusCode: 404 } };
  }

  const post = postResult[0]!;

  // Verify the post belongs to a public community
  const channelResult = await db
    .select({ serverId: channels.serverId })
    .from(channels)
    .where(eq(channels.id, post.channelId))
    .limit(1);

  if (channelResult.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Post not found", statusCode: 404 } };
  }

  const serverId = channelResult[0]!.serverId;

  const communityResult = await db
    .select({
      slug: communities.slug,
      isPublic: communities.isPublic,
    })
    .from(communities)
    .where(eq(communities.serverId, serverId))
    .limit(1);

  if (communityResult.length === 0 || !communityResult[0]!.isPublic) {
    return { data: null, error: { code: "NOT_FOUND", message: "Post not found", statusCode: 404 } };
  }

  const communitySlug = communityResult[0]!.slug;

  // Get server info
  const [serverInfo] = await db
    .select({ name: servers.name, iconUrl: servers.iconUrl })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  // Fetch comments
  const commentConditions = [
    eq(messages.replyToId, BigInt(postId)),
    eq(messages.deleted, false),
  ];

  if (options.commentBefore) {
    commentConditions.push(lt(messages.id, BigInt(options.commentBefore)));
  }

  let commentOrderBy;
  switch (options.commentSort) {
    case "new":
      commentOrderBy = [desc(messages.createdAt)];
      break;
    case "top":
    case "old":
    default:
      commentOrderBy = [messages.createdAt];
      break;
  }

  const commentsResult = await db
    .select({
      id: messages.id,
      content: messages.content,
      authorId: messages.authorId,
      replyToId: messages.replyToId,
      createdAt: messages.createdAt,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(messages)
    .innerJoin(users, eq(messages.authorId, users.id))
    .where(and(...commentConditions))
    .orderBy(...commentOrderBy)
    .limit(commentLimit);

  const commentItems: PublicComment[] = commentsResult.map((c) => ({
    id: c.id.toString(),
    content: c.content,
    authorId: c.authorId,
    replyToId: c.replyToId?.toString() ?? null,
    createdAt: c.createdAt.toISOString(),
    author: {
      username: c.username,
      displayName: c.displayName,
      avatarUrl: c.avatarUrl,
    },
    replies: [],
  }));

  const commentNextCursor = commentItems.length === commentLimit
    ? commentItems[commentItems.length - 1]!.id
    : null;

  return {
    data: {
      post: {
        id: post.id.toString(),
        title: post.title,
        content: post.content,
        upvotes: post.upvotes,
        downvotes: post.downvotes,
        score: post.score,
        pinned: post.pinned,
        locked: post.locked,
        commentCount: post.commentCount,
        tags: post.tags as string[],
        createdAt: post.createdAt.toISOString(),
        author: {
          username: post.username,
          displayName: post.displayName,
          avatarUrl: post.avatarUrl,
        },
        community: {
          slug: communitySlug,
          name: serverInfo?.name ?? communitySlug,
          iconUrl: serverInfo?.iconUrl ?? null,
        },
      },
      comments: {
        items: commentItems,
        nextCursor: commentNextCursor,
      },
    },
    error: null,
  };
}

export async function getTrendingPosts(
  options: {
    period?: "hour" | "day" | "week";
    limit?: number;
    before?: string;
  },
): Promise<ServiceResult<PaginatedResponse<PublicTrendingPost>>> {
  const safeLimit = Math.min(Math.max(options.limit ?? 25, 1), 50);
  const period = options.period ?? "day";

  const cacheKey = !options.before ? `trending:${period}:${safeLimit}` : null;

  if (cacheKey) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return { data: JSON.parse(cached), error: null };
    }
  }

  const intervals: Record<string, string> = {
    hour: "1 hour",
    day: "1 day",
    week: "7 days",
  };
  const interval = intervals[period] ?? "1 day";

  const conditions = [
    eq(communities.isPublic, true),
    sql`${forumPosts.createdAt} > NOW() - INTERVAL '${sql.raw(interval)}'`,
  ];

  if (options.before) {
    conditions.push(lt(forumPosts.id, BigInt(options.before)));
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
    })
    .from(forumPosts)
    .innerJoin(channels, eq(forumPosts.channelId, channels.id))
    .innerJoin(communities, eq(channels.serverId, communities.serverId))
    .innerJoin(servers, eq(communities.serverId, servers.id))
    .innerJoin(users, eq(forumPosts.authorId, users.id))
    .where(and(...conditions))
    .orderBy(sql`hot_rank(${forumPosts.score}, ${forumPosts.createdAt}) DESC`)
    .limit(safeLimit);

  const items: PublicTrendingPost[] = result.map((r) => ({
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
  }));

  const nextCursor = items.length === safeLimit ? items[items.length - 1]!.id : null;
  const response: PaginatedResponse<PublicTrendingPost> = { items, nextCursor };

  if (cacheKey) {
    await redis.set(cacheKey, JSON.stringify(response), "EX", 300);
  }

  return { data: response, error: null };
}

export async function search(
  options: {
    q: string;
    type?: "all" | "communities" | "posts";
    community?: string;
    sort?: "relevance" | "new" | "top";
    limit?: number;
    before?: string;
  },
): Promise<ServiceResult<SearchResults>> {
  if (!options.q || options.q.length < 2 || options.q.length > 200) {
    return {
      data: null,
      error: {
        code: "BAD_REQUEST",
        message: "Search query is required and must be between 2 and 200 characters",
        statusCode: 400,
      },
    };
  }

  const safeLimit = Math.min(Math.max(options.limit ?? 25, 1), 50);
  const type = options.type ?? "all";
  const sort = options.sort ?? "relevance";
  const tsquery = sql`plainto_tsquery('english', ${options.q})`;

  let communityResults: SearchResults["communities"] = [];
  let postResults: SearchResults["posts"] = { items: [], nextCursor: null };

  // Search communities
  if (type === "all" || type === "communities") {
    const communityLimit = type === "all" ? 5 : safeLimit;

    const communityRows = await db
      .select({
        serverId: communities.serverId,
        slug: communities.slug,
        name: servers.name,
        description: communities.description,
        subscriberCount: communities.subscriberCount,
        iconUrl: servers.iconUrl,
        createdAt: communities.createdAt,
      })
      .from(communities)
      .innerJoin(servers, eq(communities.serverId, servers.id))
      .where(
        and(
          eq(communities.isPublic, true),
          sql`${communities}.search_vector @@ ${tsquery}`,
        ),
      )
      .orderBy(sql`ts_rank_cd(${communities}.search_vector, ${tsquery}) DESC`)
      .limit(communityLimit);

    communityResults = communityRows.map((r) => ({
      serverId: r.serverId,
      slug: r.slug,
      name: r.name,
      description: r.description,
      category: null,
      tags: [],
      bannerUrl: null,
      subscriberCount: r.subscriberCount,
      iconUrl: r.iconUrl,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // Search posts
  if (type === "all" || type === "posts") {
    const postConditions = [
      eq(communities.isPublic, true),
      sql`${forumPosts}.search_vector @@ ${tsquery}`,
    ];

    if (options.community) {
      postConditions.push(eq(communities.slug, options.community));
    }

    if (options.before) {
      postConditions.push(lt(forumPosts.id, BigInt(options.before)));
    }

    let postOrderBy;
    switch (sort) {
      case "new":
        postOrderBy = [desc(forumPosts.createdAt)];
        break;
      case "top":
        postOrderBy = [desc(forumPosts.score)];
        break;
      case "relevance":
      default:
        postOrderBy = [sql`ts_rank_cd(${forumPosts}.search_vector, ${tsquery}) DESC`];
        break;
    }

    const postRows = await db
      .select({
        id: forumPosts.id,
        title: forumPosts.title,
        content: forumPosts.content,
        score: forumPosts.score,
        commentCount: forumPosts.commentCount,
        createdAt: forumPosts.createdAt,
        username: users.username,
        displayName: users.displayName,
        slug: communities.slug,
        serverName: servers.name,
        relevanceScore: sql<number>`ts_rank_cd(${forumPosts}.search_vector, ${tsquery})`,
        snippet: sql<string>`ts_headline('english', ${forumPosts.content}, ${tsquery}, 'MaxWords=35, MinWords=15')`,
      })
      .from(forumPosts)
      .innerJoin(channels, eq(forumPosts.channelId, channels.id))
      .innerJoin(communities, eq(channels.serverId, communities.serverId))
      .innerJoin(servers, eq(communities.serverId, servers.id))
      .innerJoin(users, eq(forumPosts.authorId, users.id))
      .where(and(...postConditions))
      .orderBy(...postOrderBy)
      .limit(safeLimit);

    const items = postRows.map((r) => ({
      id: r.id.toString(),
      title: r.title,
      excerpt: r.content.length > 200 ? r.content.slice(0, 200) + "..." : r.content,
      snippet: r.snippet,
      score: r.score,
      commentCount: r.commentCount,
      createdAt: r.createdAt.toISOString(),
      author: {
        username: r.username,
        displayName: r.displayName,
      },
      community: {
        slug: r.slug,
        name: r.serverName,
      },
      relevanceScore: r.relevanceScore,
    }));

    const nextCursor = items.length === safeLimit ? items[items.length - 1]!.id : null;
    postResults = { items, nextCursor };
  }

  return {
    data: { communities: communityResults, posts: postResults },
    error: null,
  };
}

export async function getCommunityMeta(
  slug: string,
): Promise<ServiceResult<SEOMetadata>> {
  const result = await db
    .select({
      slug: communities.slug,
      description: communities.description,
      subscriberCount: communities.subscriberCount,
      name: servers.name,
      iconUrl: servers.iconUrl,
    })
    .from(communities)
    .innerJoin(servers, eq(communities.serverId, servers.id))
    .where(and(eq(communities.slug, slug), eq(communities.isPublic, true)))
    .limit(1);

  if (result.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Community not found", statusCode: 404 } };
  }

  const c = result[0]!;
  return {
    data: {
      title: `${c.name} - Concord`,
      description: c.description ?? `${c.name} community on Concord`,
      image: c.iconUrl,
      url: `https://concord.codeswhat.com/g/${c.slug}`,
      type: "website",
      subscriberCount: c.subscriberCount,
    },
    error: null,
  };
}

export async function getPostMeta(
  postId: string,
): Promise<ServiceResult<SEOMetadata>> {
  const postResult = await db
    .select({
      id: forumPosts.id,
      title: forumPosts.title,
      content: forumPosts.content,
      createdAt: forumPosts.createdAt,
      channelId: forumPosts.channelId,
      username: users.username,
    })
    .from(forumPosts)
    .innerJoin(users, eq(forumPosts.authorId, users.id))
    .where(eq(forumPosts.id, BigInt(postId)))
    .limit(1);

  if (postResult.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Post not found", statusCode: 404 } };
  }

  const post = postResult[0]!;

  // Resolve community
  const channelResult = await db
    .select({ serverId: channels.serverId })
    .from(channels)
    .where(eq(channels.id, post.channelId))
    .limit(1);

  if (channelResult.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Post not found", statusCode: 404 } };
  }

  const communityResult = await db
    .select({ slug: communities.slug, isPublic: communities.isPublic })
    .from(communities)
    .where(eq(communities.serverId, channelResult[0]!.serverId))
    .limit(1);

  if (communityResult.length === 0 || !communityResult[0]!.isPublic) {
    return { data: null, error: { code: "NOT_FOUND", message: "Post not found", statusCode: 404 } };
  }

  const slug = communityResult[0]!.slug;
  const [serverInfo] = await db
    .select({ name: servers.name })
    .from(servers)
    .where(eq(servers.id, channelResult[0]!.serverId))
    .limit(1);

  const titleSlug = post.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return {
    data: {
      title: `${post.title} - ${serverInfo?.name ?? slug} - Concord`,
      description: post.content.length > 200 ? post.content.slice(0, 200) + "..." : post.content,
      image: null,
      url: `https://concord.codeswhat.com/g/${slug}/${post.id.toString()}/${titleSlug}`,
      type: "article",
      author: post.username,
      publishedTime: post.createdAt.toISOString(),
      section: serverInfo?.name ?? slug,
    },
    error: null,
  };
}
