import { eq, and, lt, desc, sql } from "drizzle-orm";
import { db } from "../db.js";
import { forumPosts, forumVotes, messages, users } from "../models/schema.js";
import { generateSnowflake } from "../utils/snowflake.js";
import type { ServiceResult } from "@concord/shared";

interface ForumPostWithAuthor {
  id: string;
  channelId: string;
  authorId: string;
  title: string;
  content: string;
  upvotes: number;
  downvotes: number;
  score: number;
  pinned: boolean;
  locked: boolean;
  commentCount: number;
  tags: unknown;
  createdAt: Date;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export async function createPost(
  channelId: string,
  authorId: string,
  data: { title: string; content: string; tags?: string[] },
): Promise<ServiceResult<ForumPostWithAuthor>> {
  if (!data.title || data.title.trim().length === 0 || data.title.length > 300) {
    return {
      data: null,
      error: { code: "BAD_REQUEST", message: "Title must be between 1 and 300 characters", statusCode: 400 },
    };
  }

  const id = BigInt(generateSnowflake());

  const [post] = await db
    .insert(forumPosts)
    .values({
      id,
      channelId,
      authorId,
      title: data.title.trim(),
      content: data.content,
      tags: data.tags ?? [],
    })
    .returning();

  if (!post) {
    return { data: null, error: { code: "INTERNAL", message: "Failed to create post", statusCode: 500 } };
  }

  const [author] = await db
    .select({ username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, authorId))
    .limit(1);

  return {
    data: {
      id: post.id.toString(),
      channelId: post.channelId,
      authorId: post.authorId,
      title: post.title,
      content: post.content,
      upvotes: post.upvotes,
      downvotes: post.downvotes,
      score: post.score,
      pinned: post.pinned,
      locked: post.locked,
      commentCount: post.commentCount,
      tags: post.tags,
      createdAt: post.createdAt,
      author: author
        ? { username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl }
        : { username: "unknown", displayName: "Unknown", avatarUrl: null },
    },
    error: null,
  };
}

export async function getPosts(
  channelId: string,
  options: { sort?: string; before?: string; limit?: number },
): Promise<ServiceResult<ForumPostWithAuthor[]>> {
  const safeLimit = Math.min(Math.max(options.limit ?? 25, 1), 50);
  const sort = options.sort ?? "hot";

  const conditions = options.before
    ? and(eq(forumPosts.channelId, channelId), lt(forumPosts.id, BigInt(options.before)))
    : eq(forumPosts.channelId, channelId);

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
      orderBy = [desc(forumPosts.score), desc(forumPosts.createdAt)];
      break;
  }

  const result = await db
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
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(forumPosts)
    .innerJoin(users, eq(forumPosts.authorId, users.id))
    .where(conditions)
    .orderBy(...orderBy)
    .limit(safeLimit);

  const mapped: ForumPostWithAuthor[] = result.map((r) => ({
    id: r.id.toString(),
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
    author: {
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    },
  }));

  return { data: mapped, error: null };
}

export async function getPost(
  postId: string,
): Promise<ServiceResult<ForumPostWithAuthor>> {
  const result = await db
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
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(forumPosts)
    .innerJoin(users, eq(forumPosts.authorId, users.id))
    .where(eq(forumPosts.id, BigInt(postId)))
    .limit(1);

  if (result.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Post not found", statusCode: 404 } };
  }

  const r = result[0]!;
  return {
    data: {
      id: r.id.toString(),
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
      author: {
        username: r.username,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
      },
    },
    error: null,
  };
}

export async function updatePost(
  postId: string,
  authorId: string,
  updates: { title?: string; content?: string; tags?: string[]; pinned?: boolean; locked?: boolean },
): Promise<ServiceResult<ForumPostWithAuthor>> {
  const existing = await db
    .select()
    .from(forumPosts)
    .where(eq(forumPosts.id, BigInt(postId)))
    .limit(1);

  if (existing.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Post not found", statusCode: 404 } };
  }

  if (existing[0]!.authorId !== authorId) {
    return { data: null, error: { code: "FORBIDDEN", message: "Can only edit your own posts", statusCode: 403 } };
  }

  if (updates.title !== undefined) {
    if (updates.title.trim().length === 0 || updates.title.length > 300) {
      return {
        data: null,
        error: { code: "BAD_REQUEST", message: "Title must be between 1 and 300 characters", statusCode: 400 },
      };
    }
  }

  const setValues: Record<string, unknown> = {};
  if (updates.title !== undefined) setValues["title"] = updates.title.trim();
  if (updates.content !== undefined) setValues["content"] = updates.content;
  if (updates.tags !== undefined) setValues["tags"] = updates.tags;
  if (updates.pinned !== undefined) setValues["pinned"] = updates.pinned;
  if (updates.locked !== undefined) setValues["locked"] = updates.locked;

  if (Object.keys(setValues).length === 0) {
    return getPost(postId);
  }

  await db
    .update(forumPosts)
    .set(setValues)
    .where(eq(forumPosts.id, BigInt(postId)));

  return getPost(postId);
}

export async function deletePost(
  postId: string,
): Promise<ServiceResult<{ deleted: true }>> {
  const existing = await db
    .select()
    .from(forumPosts)
    .where(eq(forumPosts.id, BigInt(postId)))
    .limit(1);

  if (existing.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Post not found", statusCode: 404 } };
  }

  // Votes are cascade-deleted via FK constraint
  await db.delete(forumPosts).where(eq(forumPosts.id, BigInt(postId)));

  return { data: { deleted: true }, error: null };
}

export async function vote(
  postId: string,
  userId: string,
  value: number,
): Promise<ServiceResult<{ upvotes: number; downvotes: number; score: number; userVote: number | null }>> {
  // Verify post exists
  const existing = await db
    .select({ id: forumPosts.id })
    .from(forumPosts)
    .where(eq(forumPosts.id, BigInt(postId)))
    .limit(1);

  if (existing.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Post not found", statusCode: 404 } };
  }

  const postIdBig = BigInt(postId);

  if (value === 0) {
    // Remove vote
    await db
      .delete(forumVotes)
      .where(and(eq(forumVotes.postId, postIdBig), eq(forumVotes.userId, userId)));
  } else {
    // Upsert vote
    await db
      .insert(forumVotes)
      .values({ postId: postIdBig, userId, value })
      .onConflictDoUpdate({
        target: [forumVotes.postId, forumVotes.userId],
        set: { value, createdAt: new Date() },
      });
  }

  // Recalculate score from votes
  const [counts] = await db
    .select({
      upvotes: sql<number>`COALESCE(SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END), 0)::int`,
      downvotes: sql<number>`COALESCE(SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END), 0)::int`,
    })
    .from(forumVotes)
    .where(eq(forumVotes.postId, postIdBig));

  const upvotes = counts?.upvotes ?? 0;
  const downvotes = counts?.downvotes ?? 0;
  const score = upvotes - downvotes;

  await db
    .update(forumPosts)
    .set({ upvotes, downvotes, score })
    .where(eq(forumPosts.id, postIdBig));

  return {
    data: {
      upvotes,
      downvotes,
      score,
      userVote: value === 0 ? null : value,
    },
    error: null,
  };
}

export async function getUserVote(
  postId: string,
  userId: string,
): Promise<ServiceResult<{ value: number | null }>> {
  const result = await db
    .select({ value: forumVotes.value })
    .from(forumVotes)
    .where(and(eq(forumVotes.postId, BigInt(postId)), eq(forumVotes.userId, userId)))
    .limit(1);

  return {
    data: { value: result.length > 0 ? result[0]!.value : null },
    error: null,
  };
}

interface CommentWithAuthor {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  replyToId: string | null;
  createdAt: Date;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export async function getComments(
  postId: string,
  options: { before?: string; limit?: number },
): Promise<ServiceResult<CommentWithAuthor[]>> {
  const safeLimit = Math.min(Math.max(options.limit ?? 25, 1), 50);
  const postIdBig = BigInt(postId);

  const conditions = options.before
    ? and(eq(messages.replyToId, postIdBig), eq(messages.deleted, false), lt(messages.id, BigInt(options.before)))
    : and(eq(messages.replyToId, postIdBig), eq(messages.deleted, false));

  const result = await db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      authorId: messages.authorId,
      content: messages.content,
      replyToId: messages.replyToId,
      createdAt: messages.createdAt,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(messages)
    .innerJoin(users, eq(messages.authorId, users.id))
    .where(conditions)
    .orderBy(messages.createdAt)
    .limit(safeLimit);

  const mapped: CommentWithAuthor[] = result.map((r) => ({
    id: r.id.toString(),
    channelId: r.channelId,
    authorId: r.authorId,
    content: r.content,
    replyToId: r.replyToId?.toString() ?? null,
    createdAt: r.createdAt,
    author: {
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    },
  }));

  return { data: mapped, error: null };
}

export async function createComment(
  postId: string,
  channelId: string,
  authorId: string,
  content: string,
): Promise<ServiceResult<CommentWithAuthor>> {
  // Verify post exists
  const existing = await db
    .select({ id: forumPosts.id, locked: forumPosts.locked })
    .from(forumPosts)
    .where(eq(forumPosts.id, BigInt(postId)))
    .limit(1);

  if (existing.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Post not found", statusCode: 404 } };
  }

  if (existing[0]!.locked) {
    return { data: null, error: { code: "FORBIDDEN", message: "Post is locked", statusCode: 403 } };
  }

  const id = BigInt(generateSnowflake());

  const [message] = await db
    .insert(messages)
    .values({
      id,
      channelId,
      authorId,
      content,
      replyToId: BigInt(postId),
    })
    .returning();

  if (!message) {
    return { data: null, error: { code: "INTERNAL", message: "Failed to create comment", statusCode: 500 } };
  }

  // Increment comment count
  await db
    .update(forumPosts)
    .set({ commentCount: sql`${forumPosts.commentCount} + 1` })
    .where(eq(forumPosts.id, BigInt(postId)));

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
      replyToId: message.replyToId?.toString() ?? null,
      createdAt: message.createdAt,
      author: author
        ? { username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl }
        : { username: "unknown", displayName: "Unknown", avatarUrl: null },
    },
    error: null,
  };
}
