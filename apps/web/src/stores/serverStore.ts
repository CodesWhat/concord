import { create } from "zustand";
import { api } from "../api/client.js";

interface Server {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  description: string | null;
  createdAt: string;
}

interface Member {
  userId: string;
  nickname: string | null;
  joinedAt: string;
  user: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    status: string;
  };
  roles: Array<{ id: string; name: string; color: string | null; position: number }>;
}

interface Role {
  id: string;
  serverId: string;
  name: string;
  color: string | null;
  position: number;
  permissions: number;
  mentionable: boolean;
  hoisted: boolean;
}

interface Ban {
  userId: string;
  serverId: string;
  reason: string | null;
  bannedBy: string;
  createdAt: string;
  user: { username: string; displayName: string; avatarUrl: string | null };
}

interface ServerState {
  servers: Server[];
  selectedServerId: string | null;
  members: Member[];
  roles: Role[];
  bans: Ban[];
  isLoading: boolean;
  fetchServers: () => Promise<void>;
  selectServer: (id: string) => void;
  fetchMembers: (serverId: string) => Promise<void>;
  createServer: (name: string) => Promise<void>;
  fetchRoles: (serverId: string) => Promise<void>;
  createRole: (serverId: string, name: string) => Promise<Role | null>;
  updateRole: (serverId: string, roleId: string, updates: Partial<Role>) => Promise<void>;
  deleteRole: (serverId: string, roleId: string) => Promise<void>;
  assignRole: (serverId: string, userId: string, roleId: string) => Promise<void>;
  removeRole: (serverId: string, userId: string, roleId: string) => Promise<void>;
  leaveServer: (serverId: string) => Promise<void>;
  kickMember: (serverId: string, memberId: string) => Promise<boolean>;
  banMember: (serverId: string, memberId: string, reason?: string) => Promise<boolean>;
  unbanMember: (serverId: string, userId: string) => Promise<boolean>;
  fetchBans: (serverId: string) => Promise<void>;
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  selectedServerId: null,
  members: [],
  roles: [],
  bans: [],
  isLoading: false,

  fetchServers: async () => {
    set({ isLoading: true });
    try {
      const servers = await api.get<Server[]>("/api/v1/users/@me/servers");
      set({ servers, isLoading: false });
    } catch (err) {
      console.warn("[serverStore] fetchServers failed:", err);
      set({ isLoading: false });
    }
  },

  selectServer: (id: string) => {
    set({ selectedServerId: id });
  },

  fetchMembers: async (serverId: string) => {
    try {
      const members = await api.get<Member[]>(
        `/api/v1/servers/${serverId}/members`,
      );
      set({ members });
    } catch (err) {
      console.warn("[serverStore] fetchMembers failed:", err);
    }
  },

  createServer: async (name: string) => {
    try {
      const server = await api.post<Server>("/api/v1/servers", { name });
      set((s) => ({
        servers: [...s.servers, server],
        selectedServerId: server.id,
      }));
    } catch (err) {
      console.error("[serverStore] createServer failed:", err);
    }
  },

  fetchRoles: async (serverId: string) => {
    try {
      const roles = await api.get<Role[]>(`/api/v1/servers/${serverId}/roles`);
      set({ roles });
    } catch (err) {
      console.warn("[serverStore] fetchRoles failed:", err);
    }
  },

  createRole: async (serverId: string, name: string) => {
    try {
      const role = await api.post<Role>(`/api/v1/servers/${serverId}/roles`, { name });
      set((s) => ({ roles: [role, ...s.roles] }));
      return role;
    } catch (err) {
      console.error("[serverStore] createRole failed:", err);
      return null;
    }
  },

  updateRole: async (serverId: string, roleId: string, updates: Partial<Role>) => {
    try {
      const role = await api.patch<Role>(`/api/v1/servers/${serverId}/roles/${roleId}`, updates);
      set((s) => ({ roles: s.roles.map((r) => (r.id === roleId ? role : r)) }));
    } catch (err) {
      console.error("[serverStore] updateRole failed:", err);
    }
  },

  deleteRole: async (serverId: string, roleId: string) => {
    try {
      await api.delete(`/api/v1/servers/${serverId}/roles/${roleId}`);
      set((s) => ({ roles: s.roles.filter((r) => r.id !== roleId) }));
    } catch (err) {
      console.error("[serverStore] deleteRole failed:", err);
    }
  },

  assignRole: async (serverId: string, userId: string, roleId: string) => {
    try {
      await api.put(`/api/v1/servers/${serverId}/members/${userId}/roles/${roleId}`);
    } catch (err) {
      console.error("[serverStore] assignRole failed:", err);
    }
  },

  removeRole: async (serverId: string, userId: string, roleId: string) => {
    try {
      await api.delete(`/api/v1/servers/${serverId}/members/${userId}/roles/${roleId}`);
    } catch (err) {
      console.error("[serverStore] removeRole failed:", err);
    }
  },

  leaveServer: async (serverId: string) => {
    await api.delete(`/api/v1/servers/${serverId}/members/@me`);
    set((state) => ({
      servers: state.servers.filter((s) => s.id !== serverId),
      selectedServerId: state.selectedServerId === serverId ? null : state.selectedServerId,
    }));
  },

  kickMember: async (serverId: string, memberId: string) => {
    try {
      await api.post(`/api/v1/servers/${serverId}/members/${memberId}/kick`);
      set((s) => ({ members: s.members.filter((m) => m.userId !== memberId) }));
      return true;
    } catch (err) {
      console.error("[serverStore] kickMember failed:", err);
      return false;
    }
  },

  banMember: async (serverId: string, memberId: string, reason?: string) => {
    try {
      await api.post(`/api/v1/servers/${serverId}/members/${memberId}/ban`, { reason });
      set((s) => ({ members: s.members.filter((m) => m.userId !== memberId) }));
      return true;
    } catch (err) {
      console.error("[serverStore] banMember failed:", err);
      return false;
    }
  },

  unbanMember: async (serverId: string, userId: string) => {
    try {
      await api.delete(`/api/v1/servers/${serverId}/bans/${userId}`);
      set((s) => ({ bans: s.bans.filter((b) => b.userId !== userId) }));
      return true;
    } catch (err) {
      console.error("[serverStore] unbanMember failed:", err);
      return false;
    }
  },

  fetchBans: async (serverId: string) => {
    try {
      const bans = await api.get<Ban[]>(`/api/v1/servers/${serverId}/bans`);
      set({ bans });
    } catch (err) {
      console.warn("[serverStore] fetchBans failed:", err);
    }
  },
}));
