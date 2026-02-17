import {
  getPendingMessages,
  removePendingMessage,
  queuePendingMessage,
} from "./offlineDb.js";
import { api } from "../api/client.js";

class OfflineSync {
  private isOnline = navigator.onLine;
  private listeners: Set<(online: boolean) => void> = new Set();

  constructor() {
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.notify();
      this.syncPending();
    });
    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.notify();
    });
  }

  get online() {
    return this.isOnline;
  }

  subscribe(fn: (online: boolean) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    for (const fn of this.listeners) fn(this.isOnline);
  }

  async syncPending(): Promise<void> {
    if (!this.isOnline) return;
    const pending = await getPendingMessages();
    for (const msg of pending) {
      try {
        await api.post(`/api/v1/channels/${msg.channelId}/messages`, {
          content: msg.content,
        });
        await removePendingMessage(msg.id);
      } catch {
        // Will retry on next sync
        break;
      }
    }
  }

  async queueMessage(channelId: string, content: string): Promise<string> {
    const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await queuePendingMessage({
      id,
      channelId,
      content,
      createdAt: new Date().toISOString(),
      status: "pending",
    });
    return id;
  }
}

export const offlineSync = new OfflineSync();
