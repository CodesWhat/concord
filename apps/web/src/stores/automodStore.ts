import { create } from "zustand";
import { api } from "../api/client.js";

interface AutomodRule {
  id: string;
  serverId: string;
  type: "word_filter" | "link_filter" | "spam" | "raid";
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  action: string;
  createdAt: string;
  updatedAt: string;
}

interface AutomodState {
  rules: AutomodRule[];
  isLoading: boolean;
  fetchRules: (serverId: string) => Promise<void>;
  createRule: (serverId: string, data: Partial<AutomodRule>) => Promise<void>;
  updateRule: (serverId: string, ruleId: string, data: Partial<AutomodRule>) => Promise<void>;
  deleteRule: (serverId: string, ruleId: string) => Promise<void>;
  toggleRule: (serverId: string, ruleId: string, enabled: boolean) => Promise<void>;
}

export const useAutomodStore = create<AutomodState>((set, get) => ({
  rules: [],
  isLoading: false,

  fetchRules: async (serverId) => {
    set({ isLoading: true });
    try {
      const rules = await api.get<AutomodRule[]>(`/api/v1/servers/${serverId}/automod/rules`);
      set({ rules });
    } catch (err) {
      console.error("[automodStore] fetchRules error:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  createRule: async (serverId, data) => {
    try {
      await api.post(`/api/v1/servers/${serverId}/automod/rules`, data);
      await get().fetchRules(serverId);
    } catch (err) {
      console.error("[automodStore] createRule error:", err);
      throw err;
    }
  },

  updateRule: async (serverId, ruleId, data) => {
    try {
      await api.patch(`/api/v1/servers/${serverId}/automod/rules/${ruleId}`, data);
      await get().fetchRules(serverId);
    } catch (err) {
      console.error("[automodStore] updateRule error:", err);
      throw err;
    }
  },

  deleteRule: async (serverId, ruleId) => {
    try {
      await api.delete(`/api/v1/servers/${serverId}/automod/rules/${ruleId}`);
      set((state) => ({ rules: state.rules.filter((r) => r.id !== ruleId) }));
    } catch (err) {
      console.error("[automodStore] deleteRule error:", err);
      throw err;
    }
  },

  toggleRule: async (serverId, ruleId, enabled) => {
    try {
      await api.patch(`/api/v1/servers/${serverId}/automod/rules/${ruleId}`, { enabled });
      set((state) => ({
        rules: state.rules.map((r) => (r.id === ruleId ? { ...r, enabled } : r)),
      }));
    } catch (err) {
      console.error("[automodStore] toggleRule error:", err);
      throw err;
    }
  },
}));
