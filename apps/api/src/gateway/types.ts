import type WebSocket from "ws";

// Opcodes
export enum GatewayOpcode {
  HELLO = 0,
  READY = 1,
  EVENT = 2,
  HEARTBEAT_ACK = 3,
  IDENTIFY = 4,
  HEARTBEAT = 5,
  RESUME = 6,
}

// Event types
export enum GatewayEvent {
  MESSAGE_CREATE = "MESSAGE_CREATE",
  MESSAGE_UPDATE = "MESSAGE_UPDATE",
  MESSAGE_DELETE = "MESSAGE_DELETE",
  TYPING_START = "TYPING_START",
  PRESENCE_UPDATE = "PRESENCE_UPDATE",
  MEMBER_JOIN = "MEMBER_JOIN",
  MEMBER_LEAVE = "MEMBER_LEAVE",
}

// Wire format: every message is { op, d, t?, s? }
export interface GatewayMessage {
  op: GatewayOpcode;
  d: unknown;
  t?: GatewayEvent;
  s?: number;
}

// Server -> Client payloads
export interface HelloPayload {
  heartbeat_interval: number;
}

export interface ReadyPayload {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    status: string;
  };
  servers: Array<{
    id: string;
    name: string;
    iconUrl: string | null;
    ownerId: string;
  }>;
  channels: Array<{
    id: string;
    serverId: string;
    name: string;
    type: string;
  }>;
}

// Client -> Server payloads
export interface IdentifyPayload {
  token: string;
}

export interface ResumePayload {
  token: string;
  sequence: number;
}

// Connection state tracked per WebSocket
export interface ConnectionState {
  userId: string;
  serverIds: string[];
  lastHeartbeat: number;
  sequence: number;
  identified: boolean;
}

// Dispatch event payload (wraps an event for Redis pub/sub)
export interface DispatchPayload {
  event: GatewayEvent;
  data: unknown;
  targetType: "user" | "server" | "channel";
  targetId: string;
}

// Typed send helper
export function sendPayload(ws: WebSocket, msg: GatewayMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
