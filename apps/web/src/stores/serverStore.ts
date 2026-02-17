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

interface ServerState {
  servers: Server[];
  selectedServerId: string | null;
  members: Member[];
  isLoading: boolean;
  fetchServers: () => Promise<void>;
  selectServer: (id: string) => void;
  fetchMembers: (serverId: string) => Promise<void>;
  createServer: (name: string) => Promise<void>;
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  selectedServerId: null,
  members: [],
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
}));
