import { create } from "zustand";
import { api } from "../api/client.js";

interface ThreadMessageAuthor {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ThreadMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  attachments: unknown[];
  replyToId: string | null;
  threadId: string | null;
  editedAt: string | null;
  deleted: boolean;
  createdAt: string;
  author: ThreadMessageAuthor;
}

export interface Thread {
  id: string;
  parentMessageId: string;
  channelId: string;
  name: string;
  archived: boolean;
  messageCount: number;
  createdAt: string;
}

interface ThreadState {
  activeThreadId: string | null;
  threads: Thread[];
  threadMessages: ThreadMessage[];
  isLoading: boolean;

  openThread: (threadId: string) => void;
  closeThread: () => void;
  fetchChannelThreads: (channelId: string) => Promise<void>;
  fetchThreadMessages: (threadId: string) => Promise<void>;
  createThread: (channelId: string, parentMessageId: string, name: string) => Promise<Thread | null>;
  sendThreadMessage: (threadId: string, content: string, replyToId?: string) => Promise<void>;
  addThreadMessage: (message: ThreadMessage) => void;
  updateThread: (thread: Thread) => void;
  addThread: (thread: Thread) => void;
}

export const useThreadStore = create<ThreadState>((set, get) => ({
  activeThreadId: null,
  threads: [],
  threadMessages: [],
  isLoading: false,

  openThread: (threadId: string) => {
    set({ activeThreadId: threadId, threadMessages: [] });
    get().fetchThreadMessages(threadId);
  },

  closeThread: () => {
    set({ activeThreadId: null, threadMessages: [] });
  },

  fetchChannelThreads: async (channelId: string) => {
    try {
      const threads = await api.get<Thread[]>(
        `/api/v1/channels/${channelId}/threads`,
      );
      set({ threads });
    } catch {
      // silently fail
    }
  },

  fetchThreadMessages: async (threadId: string) => {
    set({ isLoading: true });
    try {
      const messages = await api.get<ThreadMessage[]>(
        `/api/v1/threads/${threadId}/messages?limit=100`,
      );
      set({ threadMessages: messages, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createThread: async (channelId: string, parentMessageId: string, name: string) => {
    try {
      const thread = await api.post<Thread>(
        `/api/v1/channels/${channelId}/threads`,
        { parentMessageId, name },
      );
      set((s) => ({ threads: [...s.threads, thread] }));
      return thread;
    } catch {
      return null;
    }
  },

  sendThreadMessage: async (threadId: string, content: string, replyToId?: string) => {
    try {
      await api.post(`/api/v1/threads/${threadId}/messages`, {
        content,
        ...(replyToId ? { replyToId } : {}),
      });
    } catch {
      // silently fail
    }
  },

  addThreadMessage: (message: ThreadMessage) => {
    const { activeThreadId } = get();
    if (message.threadId !== activeThreadId) return;
    set((s) => {
      const exists = s.threadMessages.some((m) => m.id === message.id);
      if (exists) return s;
      return { threadMessages: [...s.threadMessages, message] };
    });
  },

  updateThread: (thread: Thread) => {
    set((s) => ({
      threads: s.threads.map((t) => (t.id === thread.id ? thread : t)),
    }));
  },

  addThread: (thread: Thread) => {
    set((s) => {
      const exists = s.threads.some((t) => t.id === thread.id);
      if (exists) return s;
      return { threads: [...s.threads, thread] };
    });
  },
}));
