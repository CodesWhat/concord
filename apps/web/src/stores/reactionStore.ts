import { create } from "zustand";
import { api } from "../api/client.js";

export interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
}

interface ReactionState {
  reactions: Record<string, Reaction[]>;
  addReaction: (channelId: string, messageId: string, emoji: string) => Promise<void>;
  removeReaction: (channelId: string, messageId: string, emoji: string) => Promise<void>;
  fetchReactions: (channelId: string, messageId: string) => Promise<void>;
  fetchReactionsBatch: (channelId: string, messageIds: string[]) => Promise<void>;
  handleReactionAdd: (data: { messageId: string; channelId: string; userId: string; emoji: string }) => void;
  handleReactionRemove: (data: { messageId: string; channelId: string; userId: string; emoji: string }) => void;
}

function applyAdd(existing: Reaction[], emoji: string, userId: string): Reaction[] {
  const idx = existing.findIndex((r) => r.emoji === emoji);
  if (idx !== -1) {
    const reaction = existing[idx]!;
    if (reaction.userIds.includes(userId)) return existing;
    const updated = [...existing];
    updated[idx] = { ...reaction, count: reaction.count + 1, userIds: [...reaction.userIds, userId] };
    return updated;
  }
  return [...existing, { emoji, count: 1, userIds: [userId] }];
}

function applyRemove(existing: Reaction[], emoji: string, userId: string): Reaction[] {
  const idx = existing.findIndex((r) => r.emoji === emoji);
  if (idx === -1) return existing;
  const reaction = existing[idx]!;
  const newUserIds = reaction.userIds.filter((id) => id !== userId);
  if (newUserIds.length === 0) {
    return existing.filter((r) => r.emoji !== emoji);
  }
  const updated = [...existing];
  updated[idx] = { ...reaction, count: newUserIds.length, userIds: newUserIds };
  return updated;
}

export const useReactionStore = create<ReactionState>((set, get) => ({
  reactions: {},

  addReaction: async (channelId: string, messageId: string, emoji: string) => {
    try {
      const encodedEmoji = encodeURIComponent(emoji);
      await api.put(
        `/api/v1/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}`,
      );
      // Gateway REACTION_ADD event will update local state
    } catch (err) {
      console.error("[reactionStore] addReaction failed:", err);
    }
  },

  removeReaction: async (channelId: string, messageId: string, emoji: string) => {
    try {
      const encodedEmoji = encodeURIComponent(emoji);
      await api.delete(
        `/api/v1/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}`,
      );
      // Gateway REACTION_REMOVE event will update local state
    } catch (err) {
      console.error("[reactionStore] removeReaction failed:", err);
    }
  },

  fetchReactions: async (channelId: string, messageId: string) => {
    try {
      const data = await api.get<Reaction[]>(
        `/api/v1/channels/${channelId}/messages/${messageId}/reactions`,
      );
      set((s) => ({ reactions: { ...s.reactions, [messageId]: data } }));
    } catch (err) {
      console.error("[reactionStore] fetchReactions failed:", err);
    }
  },

  fetchReactionsBatch: async (channelId: string, messageIds: string[]) => {
    if (messageIds.length === 0) return;
    try {
      const data = await api.post<Record<string, Reaction[]>>(
        `/api/v1/channels/${channelId}/reactions/batch`,
        { messageIds },
      );
      set((s) => ({ reactions: { ...s.reactions, ...data } }));
    } catch (err) {
      console.error("[reactionStore] fetchReactionsBatch failed:", err);
    }
  },

  handleReactionAdd: (data) => {
    set((s) => {
      const existing = s.reactions[data.messageId] ?? [];
      return {
        reactions: {
          ...s.reactions,
          [data.messageId]: applyAdd(existing, data.emoji, data.userId),
        },
      };
    });
  },

  handleReactionRemove: (data) => {
    set((s) => {
      const existing = s.reactions[data.messageId] ?? [];
      return {
        reactions: {
          ...s.reactions,
          [data.messageId]: applyRemove(existing, data.emoji, data.userId),
        },
      };
    });
  },
}));
