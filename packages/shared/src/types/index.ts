export type UserStatus = "online" | "idle" | "dnd" | "offline";

export type ChannelType = "text" | "voice" | "announcement" | "stage" | "forum";

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  status: UserStatus;
  createdAt: string;
  flags: number;
}

export interface Server {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  description: string | null;
  createdAt: string;
  settings: Record<string, unknown>;
}

export interface Channel {
  id: string;
  serverId: string;
  categoryId: string | null;
  type: ChannelType;
  name: string;
  topic: string | null;
  position: number;
  ttlSeconds: number | null;
  slowmodeSeconds: number;
  nsfw: boolean;
  permissionOverrides: Record<string, unknown>;
}

export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
  width?: number;
  height?: number;
}

export interface Thread {
  id: string;
  parentMessageId: string;
  channelId: string;
  name: string;
  archived: boolean;
  autoArchiveAfter: number | null;
  messageCount: number;
  createdAt: string;
}

export interface ReadState {
  userId: string;
  channelId: string;
  lastReadMessageId: string | null;
  mentionCount: number;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  attachments: Attachment[];
  embeds: unknown[];
  replyToId: string | null;
  threadId: string | null;
  editedAt: string | null;
  deleted: boolean;
  createdAt: string;
  reactions: Record<string, unknown>;
}

export interface AppError {
  code: string;
  message: string;
  statusCode: number;
}

export interface Role {
  id: string;
  serverId: string;
  name: string;
  color: string | null;
  position: number;
  permissions: number;
  mentionable: boolean;
  hoisted: boolean;
}

export interface PermissionOverride {
  allow: number;
  deny: number;
}

export interface ForumPost {
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
  tags: string[];
  createdAt: string;
  author?: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface Ban {
  userId: string;
  serverId: string;
  reason: string | null;
  bannedBy: string;
  createdAt: string;
  user?: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export type ServiceResult<T> =
  | { data: T; error: null }
  | { data: null; error: AppError };

// --- Cloud Community Types ---

export interface PublicCommunity {
  serverId: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  bannerUrl: string | null;
  subscriberCount: number;
  iconUrl: string | null;
  createdAt: string;
}

export interface PublicCommunityDetail extends PublicCommunity {
  isPublic: boolean;
  forumChannelId: string;
  rules: { title: string; body: string }[];
  owner: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  moderators: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  }[];
}

export interface CommunityWithChannel extends PublicCommunity {
  forumChannelId: string;
  rules: { title: string; body: string }[];
}

export interface PublicForumPost {
  id: string;
  title: string;
  content: string;
  upvotes: number;
  downvotes: number;
  score: number;
  pinned: boolean;
  locked: boolean;
  commentCount: number;
  tags: string[];
  createdAt: string;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  community: {
    slug: string;
    name: string;
  };
}

export interface PublicTrendingPost extends PublicForumPost {
  community: {
    slug: string;
    name: string;
    iconUrl: string | null;
  };
}

export interface PublicPostDetail {
  post: PublicTrendingPost;
  comments: PaginatedResponse<PublicComment>;
}

export interface PublicComment {
  id: string;
  content: string;
  authorId: string;
  replyToId: string | null;
  createdAt: string;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  replies: PublicComment[];
  hasMoreReplies?: boolean;
}

export interface FeedPost extends PublicTrendingPost {
  userVote: number | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export interface SearchResults {
  communities: PublicCommunity[];
  posts: PaginatedResponse<SearchPostResult>;
}

export interface SearchPostResult {
  id: string;
  title: string;
  excerpt: string;
  snippet: string;
  score: number;
  commentCount: number;
  createdAt: string;
  author: {
    username: string;
    displayName: string;
  };
  community: {
    slug: string;
    name: string;
  };
  relevanceScore: number;
}

export interface SEOMetadata {
  title: string;
  description: string;
  image: string | null;
  url: string;
  type: "website" | "article";
  author?: string;
  publishedTime?: string;
  section?: string;
  subscriberCount?: number;
}
