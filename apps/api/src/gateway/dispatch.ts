import Redis from "ioredis";
import { config } from "../config.js";
import {
  getConnectionsByUserId,
  getConnectionsForServer,
  getConnectionState,
} from "./connections.js";
import {
  GatewayOpcode,
  GatewayEvent,
  sendPayload,
  type DispatchPayload,
} from "./types.js";

const REDIS_CHANNEL = "concord:events";

let pub: Redis | null = null;
let sub: Redis | null = null;

export function initRedis(): void {
  pub = new Redis(config.redisUrl, { maxRetriesPerRequest: 3 });
  sub = new Redis(config.redisUrl, { maxRetriesPerRequest: 3 });

  sub.subscribe(REDIS_CHANNEL);
  sub.on("message", (_channel: string, message: string) => {
    try {
      const payload: DispatchPayload = JSON.parse(message);
      dispatchLocally(payload);
    } catch {
      // Ignore malformed messages
    }
  });

  pub.on("error", (err) => {
    console.error("[Gateway] Redis pub error:", err.message);
  });
  sub.on("error", (err) => {
    console.error("[Gateway] Redis sub error:", err.message);
  });
}

export function shutdownRedis(): void {
  pub?.disconnect();
  sub?.disconnect();
  pub = null;
  sub = null;
}

function dispatchLocally(payload: DispatchPayload): void {
  let connections;

  switch (payload.targetType) {
    case "user":
      connections = getConnectionsByUserId(payload.targetId);
      break;
    case "server":
      connections = getConnectionsForServer(payload.targetId);
      break;
    case "channel":
      // For channel dispatch, we need the serverId. Since channels map
      // to servers 1:1 in our connection model, we pass serverId as targetId
      // when dispatching to a channel. The caller must resolve this.
      connections = getConnectionsForServer(payload.targetId);
      break;
    default:
      return;
  }

  for (const ws of connections) {
    const state = getConnectionState(ws);
    if (state) {
      state.sequence++;
      sendPayload(ws, {
        op: GatewayOpcode.EVENT,
        t: payload.event,
        s: state.sequence,
        d: payload.data,
      });
    }
  }
}

function publishToRedis(payload: DispatchPayload): void {
  if (pub) {
    pub.publish(REDIS_CHANNEL, JSON.stringify(payload));
  } else {
    // No Redis, dispatch locally only
    dispatchLocally(payload);
  }
}

export function dispatchToUser(
  userId: string,
  event: GatewayEvent,
  data: unknown,
): void {
  publishToRedis({
    event,
    data,
    targetType: "user",
    targetId: userId,
  });
}

export function dispatchToServer(
  serverId: string,
  event: GatewayEvent,
  data: unknown,
): void {
  publishToRedis({
    event,
    data,
    targetType: "server",
    targetId: serverId,
  });
}

export function dispatchToChannel(
  serverId: string,
  event: GatewayEvent,
  data: unknown,
): void {
  // Channels are scoped to servers; dispatch to all server members
  publishToRedis({
    event,
    data,
    targetType: "channel",
    targetId: serverId,
  });
}
