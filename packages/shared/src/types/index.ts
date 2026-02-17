export type UserStatus = "online" | "idle" | "dnd" | "offline";

export type ChannelType = "text" | "voice" | "announcement" | "stage";

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
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

export type ServiceResult<T> =
  | { data: T; error: null }
  | { data: null; error: AppError };
