import { create } from "zustand";
import { api } from "../api/client.js";

interface ChannelUnreadState {
  lastReadMessageId: string | null;
  unreadCount: number;
  mentionCount: number;
}

interface UnreadState {
  channels: Record<string, ChannelUnreadState>;

  initFromReadyPayload: (
    readStates: Array<{
      channelId: string;
      lastReadMessageId: string | null;
      mentionCount: number;
    }>,
  ) => void;
  markChannelRead: (channelId: string, messageId: string) => Promise<void>;
  getUnreadForChannel: (channelId: string) => ChannelUnreadState;
  incrementUnread: (channelId: string) => void;
  incrementMention: (channelId: string) => void;
  handleReadStateUpdate: (data: {
    channelId: string;
    lastReadMessageId: string | null;
    mentionCount: number;
  }) => void;
}

const DEFAULT_STATE: ChannelUnreadState = {
  lastReadMessageId: null,
  unreadCount: 0,
  mentionCount: 0,
};

export const useUnreadStore = create<UnreadState>((set, get) => ({
  channels: {},

  initFromReadyPayload: (readStates) => {
    const channels: Record<string, ChannelUnreadState> = {};
    for (const rs of readStates) {
      channels[rs.channelId] = {
        lastReadMessageId: rs.lastReadMessageId,
        unreadCount: 0,
        mentionCount: rs.mentionCount,
      };
    }
    set({ channels });
  },

  markChannelRead: async (channelId, messageId) => {
    // Optimistic update
    set((s) => ({
      channels: {
        ...s.channels,
        [channelId]: {
          lastReadMessageId: messageId,
          unreadCount: 0,
          mentionCount: 0,
        },
      },
    }));
    try {
      await api.put(`/api/v1/channels/${channelId}/read-state`, {
        messageId,
      });
    } catch {
      // Silently fail — optimistic update stands
    }
  },

  getUnreadForChannel: (channelId) => {
    return get().channels[channelId] ?? DEFAULT_STATE;
  },

  incrementUnread: (channelId) => {
    set((s) => {
      const current = s.channels[channelId] ?? { ...DEFAULT_STATE };
      return {
        channels: {
          ...s.channels,
          [channelId]: {
            ...current,
            unreadCount: current.unreadCount + 1,
          },
        },
      };
    });
  },

  incrementMention: (channelId) => {
    set((s) => {
      const current = s.channels[channelId] ?? { ...DEFAULT_STATE };
      return {
        channels: {
          ...s.channels,
          [channelId]: {
            ...current,
            mentionCount: current.mentionCount + 1,
          },
        },
      };
    });
  },

  handleReadStateUpdate: (data) => {
    set((s) => ({
      channels: {
        ...s.channels,
        [data.channelId]: {
          lastReadMessageId: data.lastReadMessageId,
          unreadCount: 0,
          mentionCount: data.mentionCount,
        },
      },
    }));
  },
}));
