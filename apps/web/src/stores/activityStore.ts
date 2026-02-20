import { create } from "zustand";
import { api } from "../api/client.js";

export interface ActivityItem {
  type: "mention" | "reply" | "reaction";
  messageId: string;
  channelId: string;
  channelName: string;
  serverId: string;
  content: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  emoji?: string;
  createdAt: string;
}

type FilterType = "all" | "mentions" | "replies" | "reactions";

interface ActivityState {
  items: ActivityItem[];
  isLoading: boolean;
  hasMore: boolean;
  isOpen: boolean;
  filter: FilterType;

  open: () => void;
  close: () => void;
  toggle: () => void;
  fetchActivity: () => Promise<void>;
  loadMore: () => Promise<void>;
  setFilter: (filter: FilterType) => void;
}

function filterToType(filter: FilterType): string {
  if (filter === "mentions") return "mention";
  if (filter === "replies") return "reply";
  if (filter === "reactions") return "reaction";
  return "";
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  items: [],
  isLoading: false,
  hasMore: true,
  isOpen: false,
  filter: "all",

  open: () => {
    set({ isOpen: true });
    get().fetchActivity();
  },
  close: () => set({ isOpen: false }),
  toggle: () => {
    const wasOpen = get().isOpen;
    set({ isOpen: !wasOpen });
    if (!wasOpen) get().fetchActivity();
  },

  fetchActivity: async () => {
    set({ isLoading: true });
    try {
      const filter = get().filter;
      const typeParam = filterToType(filter);
      const params = new URLSearchParams({ limit: "30" });
      if (typeParam) params.set("type", typeParam);
      const items = await api.get<ActivityItem[]>(
        `/api/v1/users/@me/activity?${params.toString()}`,
      );
      set({ items, hasMore: items.length >= 30, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  loadMore: async () => {
    const { items, filter } = get();
    if (items.length === 0) return;
    const lastItem = items[items.length - 1]!;
    const typeParam = filterToType(filter);
    const params = new URLSearchParams({
      limit: "30",
      before: lastItem.messageId,
    });
    if (typeParam) params.set("type", typeParam);
    try {
      const more = await api.get<ActivityItem[]>(
        `/api/v1/users/@me/activity?${params.toString()}`,
      );
      set({ items: [...items, ...more], hasMore: more.length >= 30 });
    } catch {
      // ignore
    }
  },

  setFilter: (filter) => {
    set({ filter, items: [], hasMore: true });
    get().fetchActivity();
  },
}));
