import { create } from "zustand";
import { authClient } from "../api/auth.js";
import { api } from "../api/client.js";

interface User {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  bio?: string;
  avatarUrl?: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  updateProfile: (fields: Partial<Pick<User, "name" | "bio" | "avatarUrl">>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    const { data, error } = await authClient.signIn.email({
      email,
      password,
    });
    if (error) {
      set({ isLoading: false, error: error.message ?? "Login failed" });
      return false;
    }
    // Ensure the user exists in the app's users table
    try {
      await api.post("/api/v1/users/sync");
    } catch {
      // Non-fatal
    }
    set({
      user: data?.user as User | null,
      isAuthenticated: true,
      isLoading: false,
    });
    return true;
  },

  register: async (username, email, password) => {
    set({ isLoading: true, error: null });
    const { data, error } = await authClient.signUp.email({
      name: username,
      email,
      password,
    });
    if (error) {
      set({ isLoading: false, error: error.message ?? "Registration failed" });
      return false;
    }
    // Sync the Better Auth user into the app's users table
    try {
      await api.post("/api/v1/users/sync");
    } catch {
      // Non-fatal: user may already be synced
    }
    set({
      user: data?.user as User | null,
      isAuthenticated: true,
      isLoading: false,
    });
    return true;
  },

  logout: async () => {
    await authClient.signOut();
    set({ user: null, isAuthenticated: false, isLoading: false, error: null });
  },

  checkSession: async () => {
    set({ isLoading: true });
    const { data } = await authClient.getSession();
    if (data?.user) {
      set({
        user: data.user as User,
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateProfile: (fields) => {
    set((s) => ({
      user: s.user ? { ...s.user, ...fields } : s.user,
    }));
  },
}));
