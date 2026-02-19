import { create } from "zustand";
import { api } from "../api/client.js";

export interface SearchResult {
  id: string;
  channelId: string;
  channelName: string;
  authorId: string;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  content: string;
  createdAt: string;
  highlight: string;
}

interface SearchFilters {
  channelId?: string;
}

interface SearchState {
  results: SearchResult[];
  isSearching: boolean;
  query: string;
  isOpen: boolean;
  search: (serverId: string, query: string, filters?: SearchFilters) => Promise<void>;
  clearSearch: () => void;
  open: () => void;
  close: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  results: [],
  isSearching: false,
  query: "",
  isOpen: false,

  search: async (serverId: string, query: string, filters?: SearchFilters) => {
    const trimmed = query.trim();
    if (!trimmed) {
      set({ results: [], query: "" });
      return;
    }

    set({ isSearching: true, query: trimmed });

    try {
      const params = new URLSearchParams({ q: trimmed });
      if (filters?.channelId) params.set("channelId", filters.channelId);

      const results = await api.get<SearchResult[]>(
        `/api/v1/servers/${serverId}/search?${params.toString()}`,
      );
      set({ results, isSearching: false });
    } catch (err) {
      console.error("[searchStore] search failed:", err);
      set({ results: [], isSearching: false });
    }
  },

  clearSearch: () => {
    set({ results: [], query: "", isSearching: false });
  },

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, results: [], query: "", isSearching: false }),
}));
