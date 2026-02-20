import { useMessageStore, type Message } from "../stores/messageStore.js";
import { usePresenceStore } from "../stores/presenceStore.js";
import { useTypingStore } from "../stores/typingStore.js";
import { useChannelStore } from "../stores/channelStore.js";
import { useServerStore } from "../stores/serverStore.js";
import { useAuthStore } from "../stores/authStore.js";
import { useUnreadStore } from "../stores/unreadStore.js";
import { useThreadStore, type Thread, type ThreadMessage } from "../stores/threadStore.js";
import { useReactionStore } from "../stores/reactionStore.js";
import { useDmStore, type DmMessage } from "../stores/dmStore.js";
import { useVoiceStore } from "../stores/voiceStore.js";
import { offlineSync } from "../utils/offlineSync.js";

type GatewayPayload = {
  op: string;
  d?: Record<string, unknown>;
  t?: string;
};

class WebSocketClient {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = true;

  connect() {
    this.shouldReconnect = true;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/gateway`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      console.warn("[Gateway] Failed to create WebSocket, will retry");
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log("[Gateway] Connected");
      this.reconnectDelay = 1000;
      // Sync any messages queued while offline
      offlineSync.syncPending().catch(() => {});
    };

    this.ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as GatewayPayload;
        this.handlePayload(payload);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      console.log("[Gateway] Disconnected");
      this.cleanup();
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  disconnect() {
    this.shouldReconnect = false;
    this.cleanup();
    this.ws?.close();
    this.ws = null;
  }

  private handlePayload(payload: GatewayPayload) {
    switch (payload.op) {
      case "HELLO":
        this.send({ op: "IDENTIFY", d: {} });
        this.startHeartbeat(
          (payload.d?.heartbeat_interval as number) ?? 30000,
        );
        break;

      case "HEARTBEAT":
        this.send({ op: "HEARTBEAT", d: {} });
        break;

      case "READY":
        if (payload.d?.readStates) {
          useUnreadStore
            .getState()
            .initFromReadyPayload(
              payload.d.readStates as Array<{
                channelId: string;
                lastReadMessageId: string | null;
                mentionCount: number;
              }>,
            );
        }
        break;

      case "EVENT":
        this.handleEvent(payload.t ?? "", payload.d ?? {});
        break;
    }
  }

  private handleEvent(type: string, data: Record<string, unknown>) {
    switch (type) {
      case "MESSAGE_CREATE": {
        const msg = data as unknown as Message;
        useMessageStore.getState().addMessage(msg);
        const selectedChannelId =
          useChannelStore.getState().selectedChannelId;
        if (msg.channelId !== selectedChannelId) {
          useUnreadStore.getState().incrementUnread(msg.channelId);
        }
        break;
      }
      case "MESSAGE_UPDATE":
        useMessageStore.getState().updateMessage(data as unknown as Message);
        break;
      case "MESSAGE_DELETE":
        useMessageStore.getState().removeMessage((data as { id: string }).id);
        break;
      case "PRESENCE_UPDATE":
        usePresenceStore.getState().updatePresence(
          (data as { userId: string }).userId,
          (data as { status: string }).status,
        );
        break;
      case "TYPING_START":
        useTypingStore.getState().addTyping(
          (data as { channelId: string }).channelId,
          (data as { userId: string }).userId,
        );
        break;
      case "READ_STATE_UPDATE":
        useUnreadStore
          .getState()
          .handleReadStateUpdate(
            data as {
              channelId: string;
              lastReadMessageId: string | null;
              mentionCount: number;
            },
          );
        break;
      case "MEMBER_BAN": {
        const bannedUserId = (data as { userId: string }).userId;
        const bannedServerId = (data as { serverId: string }).serverId;
        const currentUser = useAuthStore.getState().user?.id;
        if (bannedUserId === currentUser) {
          const store = useServerStore.getState();
          useServerStore.setState({
            servers: store.servers.filter((s) => s.id !== bannedServerId),
            selectedServerId: store.selectedServerId === bannedServerId ? null : store.selectedServerId,
          });
        } else {
          const selected = useServerStore.getState().selectedServerId;
          if (selected === bannedServerId) {
            useServerStore.setState({
              members: useServerStore.getState().members.filter((m) => m.userId !== bannedUserId),
            });
          }
        }
        break;
      }
      case "MEMBER_LEAVE": {
        const leaveUserId = (data as { userId: string }).userId;
        const leaveServerId = (data as { serverId: string }).serverId;
        const currentUserId = useAuthStore.getState().user?.id;
        if (leaveUserId === currentUserId) {
          // Remove the server from local state
          const store = useServerStore.getState();
          useServerStore.setState({
            servers: store.servers.filter((s) => s.id !== leaveServerId),
            selectedServerId: store.selectedServerId === leaveServerId ? null : store.selectedServerId,
          });
        } else {
          // Another member left — refresh the member list if we're viewing that server
          const selectedServerId = useServerStore.getState().selectedServerId;
          if (selectedServerId === leaveServerId) {
            useServerStore.getState().fetchMembers(leaveServerId);
          }
        }
        break;
      }
      case "THREAD_CREATE":
        useThreadStore.getState().addThread(data as unknown as Thread);
        break;
      case "THREAD_UPDATE":
        useThreadStore.getState().updateThread(data as unknown as Thread);
        break;
      case "THREAD_MESSAGE_CREATE":
        useThreadStore.getState().addThreadMessage(data as unknown as ThreadMessage);
        break;
      case "REACTION_ADD":
        useReactionStore.getState().handleReactionAdd(
          data as { messageId: string; channelId: string; userId: string; emoji: string },
        );
        break;
      case "REACTION_REMOVE":
        useReactionStore.getState().handleReactionRemove(
          data as { messageId: string; channelId: string; userId: string; emoji: string },
        );
        break;
      case "DM_MESSAGE_CREATE":
        useDmStore.getState().addDmMessage(data as unknown as DmMessage);
        break;
      case "VOICE_STATE_UPDATE":
        useVoiceStore.getState().handleVoiceStateUpdate(
          data as { serverId: string; channelId: string; userId: string; state?: Record<string, unknown> },
        );
        break;
    }
  }

  private send(payload: GatewayPayload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private startHeartbeat(interval: number) {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ op: "HEARTBEAT", d: {} });
    }, interval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private cleanup() {
    this.stopHeartbeat();
  }

  private scheduleReconnect() {
    console.log(
      `[Gateway] Reconnecting in ${this.reconnectDelay / 1000}s...`,
    );
    setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect();
      }
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      this.maxReconnectDelay,
    );
  }
}

export const gateway = new WebSocketClient();
