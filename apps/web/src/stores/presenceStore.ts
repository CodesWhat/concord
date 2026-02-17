import { create } from "zustand";

interface PresenceState {
  statuses: Record<string, string>; // userId -> "online" | "idle" | "dnd" | "offline"
  updatePresence: (userId: string, status: string) => void;
  getStatus: (userId: string) => string;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  statuses: {},

  updatePresence: (userId: string, status: string) => {
    set((s) => ({
      statuses: { ...s.statuses, [userId]: status },
    }));
  },

  getStatus: (userId: string) => {
    return get().statuses[userId] ?? "offline";
  },
}));
