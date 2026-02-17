import { WebSocketServer, type WebSocket } from "ws";
import type { Server as HttpServer } from "node:http";
import { auth } from "../services/auth.js";
import { db } from "../db.js";
import { eq, inArray } from "drizzle-orm";
import { serverMembers, servers, channels, users, channelReadState } from "../models/schema.js";
import {
  GatewayOpcode,
  GatewayEvent,
  type GatewayMessage,
  type IdentifyPayload,
  sendPayload,
} from "./types.js";
import {
  addConnection,
  removeConnection,
  hasOtherConnections,
} from "./connections.js";
import {
  HEARTBEAT_INTERVAL,
  startHeartbeatChecker,
  handleHeartbeat,
} from "./heartbeat.js";
import {
  initRedis,
  shutdownRedis,
  dispatchToServer,
} from "./dispatch.js";

// Re-export dispatch functions for use by REST routes
export { dispatchToUser, dispatchToServer, dispatchToChannel } from "./dispatch.js";
export { GatewayEvent } from "./types.js";

const IDENTIFY_TIMEOUT = 10_000;

let wss: WebSocketServer | null = null;

export function initGateway(httpServer: HttpServer): void {
  wss = new WebSocketServer({ server: httpServer, path: "/gateway" });

  // Start Redis pub/sub
  initRedis();

  // Start heartbeat checker
  startHeartbeatChecker();

  wss.on("connection", (ws, req) => {
    // Send HELLO
    sendPayload(ws, {
      op: GatewayOpcode.HELLO,
      d: { heartbeat_interval: HEARTBEAT_INTERVAL },
    });

    let identified = false;

    // Set identify timeout
    const identifyTimer = setTimeout(() => {
      if (!identified) {
        ws.close(4003, "Identify timeout");
      }
    }, IDENTIFY_TIMEOUT);

    ws.on("message", async (raw) => {
      let msg: GatewayMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return; // Ignore non-JSON
      }

      switch (msg.op) {
        case GatewayOpcode.IDENTIFY: {
          if (identified) return;
          clearTimeout(identifyTimer);

          const result = await handleIdentify(ws, msg.d as IdentifyPayload, req.headers.cookie);
          if (result) {
            identified = true;
          } else {
            ws.close(4004, "Authentication failed");
          }
          break;
        }

        case GatewayOpcode.HEARTBEAT: {
          if (!identified) return;
          handleHeartbeat(ws);
          break;
        }

        default:
          // Unknown opcode, ignore
          break;
      }
    });

    ws.on("close", () => {
      clearTimeout(identifyTimer);
      const state = removeConnection(ws);

      // If user has no more connections, broadcast offline presence
      if (state && !hasOtherConnections(state.userId)) {
        for (const serverId of state.serverIds) {
          dispatchToServer(serverId, GatewayEvent.PRESENCE_UPDATE, {
            userId: state.userId,
            status: "offline",
          });
        }
      }
    });

    ws.on("error", () => {
      clearTimeout(identifyTimer);
      removeConnection(ws);
    });
  });

  console.log("[Gateway] WebSocket gateway initialized on /gateway");
}

async function handleIdentify(
  ws: WebSocket,
  payload: IdentifyPayload | undefined,
  cookieHeader: string | undefined,
): Promise<boolean> {
  try {
    // Build headers for auth validation
    // Support token in IDENTIFY payload or cookies from upgrade request
    const headers = new Headers();

    if (cookieHeader) {
      headers.set("cookie", cookieHeader);
    }

    // If a token is provided in the IDENTIFY payload, set it as a bearer token
    // and also as a cookie (Better Auth checks cookies by default)
    if (payload?.token) {
      headers.set("cookie", `better-auth.session_token=${payload.token}`);
    }

    const session = await auth.api.getSession({ headers });
    if (!session) return false;

    const userId = session.user.id;

    // Load user's servers
    const memberships = await db
      .select({
        serverId: serverMembers.serverId,
        serverName: servers.name,
        serverIcon: servers.iconUrl,
        serverOwner: servers.ownerId,
      })
      .from(serverMembers)
      .innerJoin(servers, eq(serverMembers.serverId, servers.id))
      .where(eq(serverMembers.userId, userId));

    const serverIds = memberships.map((m) => m.serverId);

    // Load channels for all user's servers in a single query
    const allChannels =
      serverIds.length > 0
        ? await db
            .select({
              id: channels.id,
              serverId: channels.serverId,
              name: channels.name,
              type: channels.type,
            })
            .from(channels)
            .where(
              serverIds.length === 1
                ? eq(channels.serverId, serverIds[0]!)
                : inArray(channels.serverId, serverIds),
            )
        : [];

    // Load user info
    const [userRow] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRow) return false;

    // Load user's read states
    const readStateRows = await db
      .select({
        channelId: channelReadState.channelId,
        lastReadMessageId: channelReadState.lastReadMessageId,
        mentionCount: channelReadState.mentionCount,
      })
      .from(channelReadState)
      .where(eq(channelReadState.userId, userId));

    const readStates = readStateRows.map((r) => ({
      channelId: r.channelId,
      lastReadMessageId: r.lastReadMessageId?.toString() ?? null,
      mentionCount: r.mentionCount,
    }));

    // Register connection
    addConnection(ws, userId, serverIds);

    // Send READY
    sendPayload(ws, {
      op: GatewayOpcode.READY,
      d: {
        user: userRow,
        servers: memberships.map((m) => ({
          id: m.serverId,
          name: m.serverName,
          iconUrl: m.serverIcon,
          ownerId: m.serverOwner,
        })),
        channels: allChannels,
        readStates,
      },
    });

    // Broadcast online presence to all servers
    for (const serverId of serverIds) {
      dispatchToServer(serverId, GatewayEvent.PRESENCE_UPDATE, {
        userId,
        status: "online",
      });
    }

    return true;
  } catch (err) {
    console.error("[Gateway] Identify error:", err);
    return false;
  }
}

export function shutdownGateway(): void {
  shutdownRedis();
  if (wss) {
    for (const client of wss.clients) {
      client.close(1001, "Server shutting down");
    }
    wss.close();
    wss = null;
  }
}
