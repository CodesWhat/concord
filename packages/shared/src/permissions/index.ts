export const Permissions = {
  MANAGE_SERVER: 1 << 0,
  MANAGE_CHANNELS: 1 << 1,
  MANAGE_ROLES: 1 << 2,
  KICK_MEMBERS: 1 << 3,
  BAN_MEMBERS: 1 << 4,
  MANAGE_MESSAGES: 1 << 5,
  SEND_MESSAGES: 1 << 6,
  READ_MESSAGES: 1 << 7,
  EMBED_LINKS: 1 << 8,
  ATTACH_FILES: 1 << 9,
  MENTION_EVERYONE: 1 << 10,
  ADD_REACTIONS: 1 << 11,
  CONNECT_VOICE: 1 << 12,
  SPEAK: 1 << 13,
  MUTE_MEMBERS: 1 << 14,
  DEAFEN_MEMBERS: 1 << 15,
  MOVE_MEMBERS: 1 << 16,
  USE_VOICE_ACTIVITY: 1 << 17,
  MANAGE_WEBHOOKS: 1 << 18,
  MANAGE_EMOJIS: 1 << 19,
  CREATE_INVITES: 1 << 20,
  VIEW_AUDIT_LOG: 1 << 21,
  MANAGE_THREADS: 1 << 22,
  SEND_MESSAGES_THREADS: 1 << 23,
  STREAM: 1 << 24,
  ADMINISTRATOR: 1 << 30,
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export function hasPermission(
  userPermissions: number,
  permission: number,
): boolean {
  if ((userPermissions & Permissions.ADMINISTRATOR) !== 0) return true;
  return (userPermissions & permission) !== 0;
}

export function addPermission(
  currentPermissions: number,
  permission: number,
): number {
  return currentPermissions | permission;
}

export function removePermission(
  currentPermissions: number,
  permission: number,
): number {
  return currentPermissions & ~permission;
}
