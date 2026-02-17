import type WebSocket from "ws";
import { getAllConnections, removeConnection } from "./connections.js";
import { GatewayOpcode, sendPayload } from "./types.js";

export const HEARTBEAT_INTERVAL = 30_000;
const CHECK_INTERVAL = 15_000;
const TIMEOUT = HEARTBEAT_INTERVAL * 2;

let checkTimer: ReturnType<typeof setInterval> | null = null;

export function startHeartbeatChecker(): void {
  if (checkTimer) return;

  checkTimer = setInterval(() => {
    const now = Date.now();
    const connections = getAllConnections();

    for (const [ws, state] of connections) {
      if (now - state.lastHeartbeat > TIMEOUT) {
        // Connection timed out
        ws.close(4009, "Heartbeat timeout");
        removeConnection(ws);
      }
    }
  }, CHECK_INTERVAL);
}

export function stopHeartbeatChecker(): void {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}

export function handleHeartbeat(ws: WebSocket): void {
  const connections = getAllConnections();
  const state = connections.get(ws);
  if (state) {
    state.lastHeartbeat = Date.now();
  }

  sendPayload(ws, {
    op: GatewayOpcode.HEARTBEAT_ACK,
    d: null,
  });
}
