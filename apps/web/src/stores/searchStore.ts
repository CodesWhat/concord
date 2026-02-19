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
  offset: number;
  hasMore: boolean;
  search: (serverId: string, query: string, filters?: SearchFilters) => Promise<void>;
  loadMore: (serverId: string) => Promise<void>;
  clearSearch: () => void;
  open: () => void;
  close: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  results: [],
  isSearching: false,
  query: "",
  isOpen: false,
  offset: 0,
  hasMore: false,

  search: async (serverId: string, query: string, filters?: SearchFilters) => {
    const trimmed = query.trim();
    if (!trimmed) {
      set({ results: [], query: "", offset: 0, hasMore: false });
      return;
    }

    set({ isSearching: true, query: trimmed, offset: 0, hasMore: false });

    try {
      const params = new URLSearchParams({ q: trimmed });
      if (filters?.channelId) params.set("channelId", filters.channelId);

      const results = await api.get<SearchResult[]>(
        `/api/v1/servers/${serverId}/search?${params.toString()}`,
      );
      set({
        results,
        isSearching: false,
        offset: results.length,
        hasMore: results.length >= 25,
      });
    } catch (err) {
      console.error("[searchStore] search failed:", err);
      set({ results: [], isSearching: false, offset: 0, hasMore: false });
    }
  },

  loadMore: async (serverId: string) => {
    const { query, offset, isSearching } = get();
    if (!query || isSearching) return;

    set({ isSearching: true });

    try {
      const params = new URLSearchParams({ q: query, offset: String(offset), limit: "25" });

      const moreResults = await api.get<SearchResult[]>(
        `/api/v1/servers/${serverId}/search?${params.toString()}`,
      );
      set((state) => ({
        results: [...state.results, ...moreResults],
        isSearching: false,
        offset: state.offset + moreResults.length,
        hasMore: moreResults.length === 25,
      }));
    } catch (err) {
      console.error("[searchStore] loadMore failed:", err);
      set({ isSearching: false });
    }
  },

  clearSearch: () => {
    set({ results: [], query: "", isSearching: false, offset: 0, hasMore: false });
  },

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, results: [], query: "", isSearching: false, offset: 0, hasMore: false }),
}));
