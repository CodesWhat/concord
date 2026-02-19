import { create } from "zustand";
import { api } from "../api/client.js";

export interface DmParticipant {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
}

export interface DmChannel {
  id: string;
  createdAt: string;
  participant: DmParticipant;
  lastMessage?: {
    content: string;
    createdAt: string;
  };
}

export interface DmMessage {
  id: string;
  dmChannelId: string;
  authorId: string;
  content: string;
  attachments: unknown[];
  editedAt: string | null;
  createdAt: string;
  author?: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

interface DmState {
  dmChannels: DmChannel[];
  selectedDmChannelId: string | null;
  messages: DmMessage[];
  isLoading: boolean;
  isSending: boolean;

  fetchDmChannels: () => Promise<void>;
  openDm: (recipientId: string) => Promise<string | null>;
  selectDmChannel: (id: string) => void;
  fetchMessages: (dmChannelId: string) => Promise<void>;
  sendMessage: (dmChannelId: string, content: string) => Promise<void>;
  addDmMessage: (msg: DmMessage) => void;
}

export const useDmStore = create<DmState>((set, get) => ({
  dmChannels: [],
  selectedDmChannelId: null,
  messages: [],
  isLoading: false,
  isSending: false,

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
    set({ selectedDmChannelId: id });
    get().fetchMessages(id);
  },

  fetchMessages: async (dmChannelId: string) => {
    set({ isLoading: true, messages: [] });
    try {
      const messages = await api.get<DmMessage[]>(
        `/api/v1/dms/${dmChannelId}/messages?limit=50`,
      );
      // API returns newest first, reverse for display (oldest at top)
      set({ messages: messages.reverse(), isLoading: false });
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

      return { dmChannels: updatedChannels };
    });
  },
}));
