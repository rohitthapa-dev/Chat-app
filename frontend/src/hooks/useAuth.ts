"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthUser, AuthState } from "../types/auth";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "dm_token";
const USER_KEY = "dm_user";
const LOGGED_OUT: AuthState = { token: null, user: null };

function readStorage(): AuthState {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    if (!token || !raw) return LOGGED_OUT;

    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("userId" in parsed) ||
      !("username" in parsed)
    ) {
      return LOGGED_OUT;
    }

    const userId = (parsed as { userId?: unknown }).userId;
    const username = (parsed as { username?: unknown }).username;

    if (typeof userId !== "string" || typeof username !== "string") {
      return LOGGED_OUT;
    }

    return {
      token,
      user: { userId, username },
    };
  } catch {
    return LOGGED_OUT;
  }
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(LOGGED_OUT);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setAuth(readStorage());
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  const persist = useCallback((token: string, user: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setAuth({ token, user });
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAuth(LOGGED_OUT);
  }, []);

  const register = useCallback(
    async (username: string, password: string): Promise<void> => {
      const res = await fetch(`${BACKEND}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Registration failed");
      persist(data.token, data.user);
    },
    [persist],
  );

  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      const res = await fetch(`${BACKEND}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Login failed");
      persist(data.token, data.user);
    },
    [persist],
  );

  const logout = useCallback(() => clear(), [clear]);

  return {
    token: auth.token,
    user: auth.user,
    isAuthenticated: !!auth.token && !!auth.user,
    register,
    login,
    logout,
  };
}
