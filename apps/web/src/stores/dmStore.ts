import { create } from "zustand";
import { api } from "../api/client.js";
import type { DmChannel, DmMessage } from "@concord/shared";

export type { DmChannel, DmMessage };

interface DmState {
  dmChannels: DmChannel[];
  selectedDmChannelId: string | null;
  messages: DmMessage[];
  isLoading: boolean;
  isSending: boolean;
  unreadCounts: Record<string, number>;
  hasMoreMessages: boolean;

  fetchDmChannels: () => Promise<void>;
  openDm: (recipientId: string) => Promise<string | null>;
  selectDmChannel: (id: string) => void;
  fetchMessages: (dmChannelId: string) => Promise<void>;
  sendMessage: (dmChannelId: string, content: string) => Promise<void>;
  addDmMessage: (msg: DmMessage) => void;
  loadMoreMessages: (dmChannelId: string) => Promise<void>;
}

export const useDmStore = create<DmState>((set, get) => ({
  dmChannels: [],
  selectedDmChannelId: null,
  messages: [],
  isLoading: false,
  isSending: false,
  unreadCounts: {},
  hasMoreMessages: false,

  fetchDmChannels: async () => {
    set({ isLoading: true });
    try {
      const channels = await api.get<DmChannel[]>("/api/v1/dms");
      set({ dmChannels: channels, isLoading: false });
    } catch (err) {
      console.error("[dmStore] fetchDmChannels failed:", err);
      set({ isLoading: false });
    }
  },

  openDm: async (recipientId: string) => {
    try {
      const result = await api.post<{ id: string }>("/api/v1/dms", {
        recipientId,
      });
      const channelId = result.id;

      // Refresh channel list to pick up new channel
      await get().fetchDmChannels();

      set({ selectedDmChannelId: channelId });
      await get().fetchMessages(channelId);
      return channelId;
    } catch (err) {
      console.error("[dmStore] openDm failed:", err);
      return null;
    }
  },

  selectDmChannel: (id: string) => {
    set((s) => ({ selectedDmChannelId: id, unreadCounts: { ...s.unreadCounts, [id]: 0 } }));
    get().fetchMessages(id);
  },

  fetchMessages: async (dmChannelId: string) => {
    set({ isLoading: true, messages: [] });
    try {
      const messages = await api.get<DmMessage[]>(
        `/api/v1/dms/${dmChannelId}/messages?limit=50`,
      );
      // API returns newest first, reverse for display (oldest at top)
      set({ messages: messages.reverse(), isLoading: false, hasMoreMessages: messages.length === 50 });
    } catch (err) {
      console.error("[dmStore] fetchMessages failed:", err);
      set({ isLoading: false });
    }
  },

  sendMessage: async (dmChannelId: string, content: string) => {
    set({ isSending: true });
    try {
      await api.post<DmMessage>(`/api/v1/dms/${dmChannelId}/messages`, {
        content,
      });
      // The gateway DM_MESSAGE_CREATE event will add the message via addDmMessage
      set({ isSending: false });
    } catch (err) {
      console.error("[dmStore] sendMessage failed:", err);
      set({ isSending: false });
    }
  },

  loadMoreMessages: async (dmChannelId: string) => {
    const { messages } = get();
    if (messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest) return;
    const oldestId = oldest.id;
    try {
      const older = await api.get<DmMessage[]>(
        `/api/v1/dms/${dmChannelId}/messages?before=${oldestId}&limit=50`,
      );
      if (older.length === 0) {
        set({ hasMoreMessages: false });
        return;
      }
      // API returns newest first, reverse for display
      set((s) => ({
        messages: [...older.reverse(), ...s.messages],
        hasMoreMessages: older.length === 50,
      }));
    } catch (err) {
      console.error("[dmStore] loadMoreMessages failed:", err);
    }
  },

  addDmMessage: (msg: DmMessage) => {
    const { selectedDmChannelId } = get();

    // Only add if we're viewing this channel; always update lastMessage
    set((s) => {
      const updatedChannels = s.dmChannels.map((ch) =>
        ch.id === msg.dmChannelId
          ? {
              ...ch,
              lastMessage: { content: msg.content, createdAt: msg.createdAt },
            }
          : ch,
      );

      if (selectedDmChannelId === msg.dmChannelId) {
        // Prevent duplicates
        const exists = s.messages.some((m) => m.id === msg.id);
        if (exists) {
          return { dmChannels: updatedChannels };
        }
        return {
          messages: [...s.messages, msg],
          dmChannels: updatedChannels,
        };
      }

      // When not viewing this channel, increment unread
      const prevCount = s.unreadCounts[msg.dmChannelId] ?? 0;
      return {
        dmChannels: updatedChannels,
        unreadCounts: { ...s.unreadCounts, [msg.dmChannelId]: prevCount + 1 },
      };
    });
  },
}));
