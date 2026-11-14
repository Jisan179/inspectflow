"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, session } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!session.hasToken()) {
      setUser(null);
      return;
    }
    try {
      setUser(await api<User>("/auth/me"));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const startSession = (data: { accessToken: string; refreshToken: string; user: User }) => {
    session.save(data.accessToken, data.refreshToken);
    setUser(data.user);
  };

  const value: AuthState = {
    user,
    loading,
    refreshUser,
    login: async (email, password) =>
      startSession(await api("/auth/login", { method: "POST", body: { email, password }, auth: false })),
    register: async (name, email, password) =>
      startSession(await api("/auth/register", { method: "POST", body: { name, email, password }, auth: false })),
    logout: async () => {
      const refreshToken = session.refreshToken();
      if (refreshToken) {
        await api("/auth/logout", { method: "POST", body: { refreshToken }, auth: false }).catch(() => {});
      }
      session.clear();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
