import { create } from "zustand";

const TYPING_TIMEOUT_MS = 8000;

interface TypingState {
  typing: Record<string, Record<string, number>>; // channelId -> userId -> timestamp
  addTyping: (channelId: string, userId: string) => void;
  removeTyping: (channelId: string, userId: string) => void;
  getTypingUsers: (channelId: string) => string[];
}

// Track cleanup timers outside the store to avoid serialization issues
const timers: Record<string, ReturnType<typeof setTimeout>> = {};

function timerKey(channelId: string, userId: string): string {
  return `${channelId}:${userId}`;
}

export const useTypingStore = create<TypingState>((set, get) => ({
  typing: {},

  addTyping: (channelId: string, userId: string) => {
    const key = timerKey(channelId, userId);

    // Clear any existing timer for this user/channel pair
    if (timers[key]) {
      clearTimeout(timers[key]);
    }

    const now = Date.now();
    set((s) => ({
      typing: {
        ...s.typing,
        [channelId]: {
          ...s.typing[channelId],
          [userId]: now,
        },
      },
    }));

    // Auto-expire after timeout
    timers[key] = setTimeout(() => {
      get().removeTyping(channelId, userId);
      delete timers[key];
    }, TYPING_TIMEOUT_MS);
  },

  removeTyping: (channelId: string, userId: string) => {
    const key = timerKey(channelId, userId);
    if (timers[key]) {
      clearTimeout(timers[key]);
      delete timers[key];
    }

    set((s) => {
      const channelTyping = s.typing[channelId];
      if (!channelTyping) return s;

      const { [userId]: _, ...rest } = channelTyping;
      if (Object.keys(rest).length === 0) {
        const { [channelId]: __, ...remainingChannels } = s.typing;
        return { typing: remainingChannels };
      }
      return {
        typing: { ...s.typing, [channelId]: rest },
      };
    });
  },

  getTypingUsers: (channelId: string) => {
    const channelTyping = get().typing[channelId];
    if (!channelTyping) return [];
    return Object.keys(channelTyping);
  },
}));
