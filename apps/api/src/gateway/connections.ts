import type WebSocket from "ws";
import type { ConnectionState } from "./types.js";

// userId -> set of WebSocket connections
const userConnections = new Map<string, Set<WebSocket>>();

// ws -> connection state
const connectionStates = new Map<WebSocket, ConnectionState>();

// serverId -> set of userIds (cached for fast lookup)
const serverUserIndex = new Map<string, Set<string>>();

export function addConnection(
  ws: WebSocket,
  userId: string,
  serverIds: string[],
): void {
  const state: ConnectionState = {
    userId,
    serverIds,
    lastHeartbeat: Date.now(),
    sequence: 0,
    identified: true,
  };
  connectionStates.set(ws, state);

  let userSet = userConnections.get(userId);
  if (!userSet) {
    userSet = new Set();
    userConnections.set(userId, userSet);
  }
  userSet.add(ws);

  // Index user into each server
  for (const serverId of serverIds) {
    let serverSet = serverUserIndex.get(serverId);
    if (!serverSet) {
      serverSet = new Set();
      serverUserIndex.set(serverId, serverSet);
    }
    serverSet.add(userId);
  }
}

export function removeConnection(ws: WebSocket): ConnectionState | undefined {
  const state = connectionStates.get(ws);
  if (!state) return undefined;

  connectionStates.delete(ws);

  const userSet = userConnections.get(state.userId);
  if (userSet) {
    userSet.delete(ws);
    if (userSet.size === 0) {
      userConnections.delete(state.userId);

      // Remove user from server index if no more connections
      for (const serverId of state.serverIds) {
        const serverSet = serverUserIndex.get(serverId);
        if (serverSet) {
          serverSet.delete(state.userId);
          if (serverSet.size === 0) {
            serverUserIndex.delete(serverId);
          }
        }
      }
    }
  }

  return state;
}

export function getConnectionState(ws: WebSocket): ConnectionState | undefined {
  return connectionStates.get(ws);
}

export function getConnectionsByUserId(userId: string): Set<WebSocket> {
  return userConnections.get(userId) ?? new Set();
}

export function getConnectionsForServer(serverId: string): Set<WebSocket> {
  const result = new Set<WebSocket>();
  const userIds = serverUserIndex.get(serverId);
  if (!userIds) return result;

  for (const userId of userIds) {
    const conns = userConnections.get(userId);
    if (conns) {
      for (const ws of conns) {
        result.add(ws);
      }
    }
  }
  return result;
}

export function getConnectionsForChannel(_channelId: string, serverId: string): Set<WebSocket> {
  // For now, all server members see all channels
  return getConnectionsForServer(serverId);
}

export function hasOtherConnections(userId: string): boolean {
  const conns = userConnections.get(userId);
  return conns !== undefined && conns.size > 0;
}

export function getAllConnections(): Map<WebSocket, ConnectionState> {
  return connectionStates;
}
