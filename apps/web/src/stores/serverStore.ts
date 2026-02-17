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

interface ServerState {
  servers: Server[];
  selectedServerId: string | null;
  members: Member[];
  roles: Role[];
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
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  selectedServerId: null,
  members: [],
  roles: [],
  isLoading: false,

  fetchServers: async () => {
    set({ isLoading: true });
    try {
      const servers = await api.get<Server[]>("/api/v1/users/@me/servers");
      set({ servers, isLoading: false });
    } catch {
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
    } catch {
      // ignore
    }
  },

  createServer: async (name: string) => {
    try {
      const server = await api.post<Server>("/api/v1/servers", { name });
      set((s) => ({
        servers: [...s.servers, server],
        selectedServerId: server.id,
      }));
    } catch {
      // ignore
    }
  },

  fetchRoles: async (serverId: string) => {
    try {
      const roles = await api.get<Role[]>(`/api/v1/servers/${serverId}/roles`);
      set({ roles });
    } catch {
      // ignore
    }
  },

  createRole: async (serverId: string, name: string) => {
    try {
      const role = await api.post<Role>(`/api/v1/servers/${serverId}/roles`, { name });
      set((s) => ({ roles: [role, ...s.roles] }));
      return role;
    } catch {
      return null;
    }
  },

  updateRole: async (serverId: string, roleId: string, updates: Partial<Role>) => {
    try {
      const role = await api.patch<Role>(`/api/v1/servers/${serverId}/roles/${roleId}`, updates);
      set((s) => ({ roles: s.roles.map((r) => (r.id === roleId ? role : r)) }));
    } catch {
      // ignore
    }
  },

  deleteRole: async (serverId: string, roleId: string) => {
    try {
      await api.delete(`/api/v1/servers/${serverId}/roles/${roleId}`);
      set((s) => ({ roles: s.roles.filter((r) => r.id !== roleId) }));
    } catch {
      // ignore
    }
  },

  assignRole: async (serverId: string, userId: string, roleId: string) => {
    try {
      await api.put(`/api/v1/servers/${serverId}/members/${userId}/roles/${roleId}`);
    } catch {
      // ignore
    }
  },

  removeRole: async (serverId: string, userId: string, roleId: string) => {
    try {
      await api.delete(`/api/v1/servers/${serverId}/members/${userId}/roles/${roleId}`);
    } catch {
      // ignore
    }
  },
}));
