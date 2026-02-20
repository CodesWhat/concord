import { create } from "zustand";
import { api } from "../api/client.js";

interface AuditEntry {
  id: string;
  serverId: string;
  actorId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  changes: Record<string, unknown>;
  reason: string | null;
  createdAt: string;
}

interface AuditState {
  entries: AuditEntry[];
  isLoading: boolean;
  hasMore: boolean;
  filter: { action?: string; actorId?: string };

  fetchAuditLog: (serverId: string) => Promise<void>;
  loadMore: (serverId: string) => Promise<void>;
  setFilter: (filter: { action?: string; actorId?: string }) => void;
  reset: () => void;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  entries: [],
  isLoading: false,
  hasMore: true,
  filter: {},

  fetchAuditLog: async (serverId: string) => {
    set({ isLoading: true });
    const { filter } = get();
    const params = new URLSearchParams();
    if (filter.action) params.set("action", filter.action);
    if (filter.actorId) params.set("actorId", filter.actorId);
    params.set("limit", "50");

    const qs = params.toString();
    const entries = await api.get<AuditEntry[]>(
      `/api/v1/servers/${serverId}/audit-log${qs ? `?${qs}` : ""}`,
    );
    set({ entries, isLoading: false, hasMore: entries.length >= 50 });
  },

  loadMore: async (serverId: string) => {
    const { entries, filter, isLoading, hasMore } = get();
    if (isLoading || !hasMore || entries.length === 0) return;

    set({ isLoading: true });
    const lastId = entries[entries.length - 1]!.id;
    const params = new URLSearchParams();
    if (filter.action) params.set("action", filter.action);
    if (filter.actorId) params.set("actorId", filter.actorId);
    params.set("before", lastId);
    params.set("limit", "50");

    const qs = params.toString();
    const more = await api.get<AuditEntry[]>(
      `/api/v1/servers/${serverId}/audit-log?${qs}`,
    );
    set({
      entries: [...entries, ...more],
      isLoading: false,
      hasMore: more.length >= 50,
    });
  },

  setFilter: (filter) => {
    set({ filter, entries: [], hasMore: true });
  },

  reset: () => {
    set({ entries: [], isLoading: false, hasMore: true, filter: {} });
  },
}));
