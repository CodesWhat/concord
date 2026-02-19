import { create } from "zustand";
import type { Attachment } from "@concord/shared";
import { api } from "../api/client.js";
import { cacheMessages, getCachedMessages } from "../utils/offlineDb.js";
import { offlineSync } from "../utils/offlineSync.js";

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
  attachments: Attachment[];
  replyToId: string | null;
  editedAt: string | null;
  deleted: boolean;
  createdAt: string;
  author: MessageAuthor;
  pending?: boolean;
}

interface MessageState {
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
  isSending: boolean;
  editingMessageId: string | null;
  newMessageIds: Set<string>;
  fetchMessages: (channelId: string) => Promise<void>;
  loadMoreMessages: (channelId: string) => Promise<void>;
  sendMessage: (channelId: string, content: string, attachments?: Attachment[]) => Promise<void>;
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  removeMessage: (id: string) => void;
  editMessage: (channelId: string, messageId: string, content: string) => Promise<void>;
  deleteMessage: (channelId: string, messageId: string) => Promise<void>;
  setEditingMessage: (id: string | null) => void;
  clearNewFlag: (id: string) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: [],
  isLoading: false,
  hasMore: true,
  isSending: false,
  editingMessageId: null,
  newMessageIds: new Set(),

  fetchMessages: async (channelId: string) => {
    set({ isLoading: true, messages: [], hasMore: true });
    try {
      const messages = await api.get<Message[]>(
        `/api/v1/channels/${channelId}/messages?limit=50`,
      );
      // API returns newest first, reverse for display (oldest at top)
      const reversed = messages.reverse();
      set({ messages: reversed, isLoading: false, hasMore: messages.length >= 50 });
      // Update offline cache in background
      cacheMessages(channelId, reversed.map((m) => ({
        ...m,
        attachments: [],
        embeds: [],
        threadId: null,
      }))).catch(() => {});
    } catch (err) {
      // Fallback to cached messages when offline
      console.warn("[messageStore] fetchMessages failed, trying cache:", err);
      try {
        const cached = await getCachedMessages(channelId);
        if (cached.length > 0) {
          cached.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          set({
            messages: cached.map((m) => ({
              id: m.id,
              channelId: m.channelId,
              authorId: m.authorId,
              content: m.content,
              attachments: (m.attachments ?? []) as Attachment[],
              replyToId: m.replyToId,
              editedAt: m.editedAt,
              deleted: m.deleted,
              createdAt: m.createdAt,
              author: m.author,
            })),
            isLoading: false,
            hasMore: false,
          });
          return;
        }
      } catch {
        // IDB also failed, nothing to show
      }
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
    } catch (err) {
      console.warn("[messageStore] loadMoreMessages failed:", err);
      set({ isLoading: false });
    }
  },

  sendMessage: async (channelId: string, content: string, attachments?: Attachment[]) => {
    // Queue to IndexedDB if offline
    if (!offlineSync.online) {
      const pendingId = await offlineSync.queueMessage(channelId, content);
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: pendingId,
            channelId,
            authorId: "",
            content,
            attachments: attachments ?? [],
            replyToId: null,
            editedAt: null,
            deleted: false,
            createdAt: new Date().toISOString(),
            author: { username: "You", displayName: "You", avatarUrl: null },
            pending: true,
          },
        ],
      }));
      return;
    }

    set({ isSending: true });
    try {
      const body: Record<string, unknown> = { content };
      if (attachments && attachments.length > 0) {
        body.attachments = attachments;
      }
      const msg = await api.post<Message>(
        `/api/v1/channels/${channelId}/messages`,
        body,
      );
      // The message from the API may not include author info in the create response.
      // We add it optimistically; the WebSocket event will provide the full message.
      set((s) => ({
        messages: [...s.messages, msg],
        isSending: false,
      }));
    } catch (err) {
      console.error("[messageStore] sendMessage failed:", err);
      set({ isSending: false });
    }
  },

  addMessage: (message: Message) => {
    set((s) => {
      const idx = s.messages.findIndex((m) => m.id === message.id);
      if (idx !== -1) {
        // Merge: replace existing (e.g., enrich optimistic message with author data)
        const updated = [...s.messages];
        updated[idx] = message;
        return { messages: updated };
      }
      const newIds = new Set(s.newMessageIds);
      newIds.add(message.id);
      return { messages: [...s.messages, message], newMessageIds: newIds };
    });
  },

  updateMessage: (message: Message) => {
    set((s) => ({
      messages: s.messages.map((m) => (m.id === message.id ? message : m)),
    }));
  },

  removeMessage: (id: string) => {
    set((s) => ({
      messages: s.messages.filter((m) => m.id !== id),
    }));
  },

  editMessage: async (channelId: string, messageId: string, content: string) => {
    // Optimistic update
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, content, editedAt: new Date().toISOString() } : m,
      ),
      editingMessageId: null,
    }));
    try {
      const updated = await api.patch<Message>(
        `/api/v1/channels/${channelId}/messages/${messageId}`,
        { content },
      );
      // Apply server response to ensure consistency
      set((s) => ({
        messages: s.messages.map((m) => (m.id === updated.id ? updated : m)),
      }));
    } catch (err) {
      console.error("[messageStore] editMessage failed:", err);
      // Refetch to restore correct state on failure
      get().fetchMessages(channelId);
    }
  },

  deleteMessage: async (channelId: string, messageId: string) => {
    // Optimistic removal
    const previous = get().messages;
    set((s) => ({
      messages: s.messages.filter((m) => m.id !== messageId),
    }));
    try {
      await api.delete(`/api/v1/channels/${channelId}/messages/${messageId}`);
    } catch (err) {
      console.error("[messageStore] deleteMessage failed:", err);
      // Restore on failure
      set({ messages: previous });
    }
  },

  setEditingMessage: (id: string | null) => {
    set({ editingMessageId: id });
  },

  clearNewFlag: (id: string) => {
    set((s) => {
      const newIds = new Set(s.newMessageIds);
      newIds.delete(id);
      return { newMessageIds: newIds };
    });
  },
}));
