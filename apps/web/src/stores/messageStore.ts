import { create } from "zustand";
import { api } from "../api/client.js";

interface MessageAuthor {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  replyToId: string | null;
  editedAt: string | null;
  deleted: boolean;
  createdAt: string;
  author: MessageAuthor;
}

interface MessageState {
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
  isSending: boolean;
  fetchMessages: (channelId: string) => Promise<void>;
  loadMoreMessages: (channelId: string) => Promise<void>;
  sendMessage: (channelId: string, content: string) => Promise<void>;
  addMessage: (message: Message) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: [],
  isLoading: false,
  hasMore: true,
  isSending: false,

  fetchMessages: async (channelId: string) => {
    set({ isLoading: true, messages: [], hasMore: true });
    try {
      const messages = await api.get<Message[]>(
        `/api/v1/channels/${channelId}/messages?limit=50`,
      );
      // API returns newest first, reverse for display (oldest at top)
      set({ messages: messages.reverse(), isLoading: false, hasMore: messages.length >= 50 });
    } catch {
      set({ isLoading: false });
    }
  },

  loadMoreMessages: async (channelId: string) => {
    const { messages, hasMore, isLoading } = get();
    if (!hasMore || isLoading || messages.length === 0) return;

    const oldestId = messages[0]?.id;
    if (!oldestId) return;

    set({ isLoading: true });
    try {
      const older = await api.get<Message[]>(
        `/api/v1/channels/${channelId}/messages?before=${oldestId}&limit=50`,
      );
      set({
        messages: [...older.reverse(), ...get().messages],
        isLoading: false,
        hasMore: older.length >= 50,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  sendMessage: async (channelId: string, content: string) => {
    set({ isSending: true });
    try {
      const msg = await api.post<Message>(
        `/api/v1/channels/${channelId}/messages`,
        { content },
      );
      // The message from the API may not include author info in the create response.
      // We add it optimistically; the WebSocket event will provide the full message.
      set((s) => ({
        messages: [...s.messages, msg],
        isSending: false,
      }));
    } catch {
      set({ isSending: false });
    }
  },

  addMessage: (message: Message) => {
    set((s) => {
      // Avoid duplicates (e.g., if we already added it optimistically)
      if (s.messages.some((m) => m.id === message.id)) return s;
      return { messages: [...s.messages, message] };
    });
  },
}));
