import { create } from "zustand";
import { api } from "../api/client.js";
import type { ChannelType } from "@concord/shared";

interface Channel {
  id: string;
  serverId: string;
  categoryId: string | null;
  type: ChannelType;
  name: string;
  topic: string | null;
  position: number;
}

interface Category {
  id: string;
  name: string;
  position: number;
}

interface ChannelGroup {
  category: Category | null;
  channels: Channel[];
}

interface ChannelState {
  channels: Channel[];
  categories: Category[];
  selectedChannelId: string | null;
  fetchChannels: (serverId: string) => Promise<void>;
  selectChannel: (id: string) => void;
  getSelectedChannel: () => Channel | undefined;
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  channels: [],
  categories: [],
  selectedChannelId: null,

  fetchChannels: async (serverId: string) => {
    try {
      const groups = await api.get<ChannelGroup[]>(
        `/api/v1/servers/${serverId}/channels`,
      );
      const channels: Channel[] = [];
      const categories: Category[] = [];

      for (const group of groups) {
        if (group.category) {
          categories.push(group.category);
        }
        channels.push(...group.channels);
      }

      set({ channels, categories });
    } catch {
      set({ channels: [], categories: [] });
    }
  },

  selectChannel: (id: string) => {
    set({ selectedChannelId: id });
  },

  getSelectedChannel: () => {
    const { channels, selectedChannelId } = get();
    return channels.find((c) => c.id === selectedChannelId);
  },
}));
