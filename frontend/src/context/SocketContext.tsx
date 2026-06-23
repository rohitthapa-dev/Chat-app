"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PresenceUser {
  username: string;
  isOnline: boolean;
  lastSeen: Date;
}

export interface DMMessage {
  _id: string;
  senderId: string;
  recipientId: string;
  channelId: string;
  content: string;
  read: boolean;
  createdAt: Date;
}

interface ServerToClientEvents {
  USER_ONLINE: (payload: { username: string }) => void;
  USER_OFFLINE: (payload: { username: string; lastSeen: Date }) => void;
  PRESENCE_SNAPSHOT: (users: PresenceUser[]) => void;
  DM_RECEIVED: (message: DMMessage) => void;
  DM_HISTORY: (messages: DMMessage[]) => void;
  ERROR: (payload: { message: string }) => void;
}

interface ClientToServerEvents {
  SEND_DM: (payload: { recipientId: string; content: string }) => void;
  FETCH_HISTORY: (payload: { targetUsername: string; limit?: number }) => void;
  MARK_READ: (payload: { channelId: string }) => void;
}

// ─── Shared utility: deterministic channel ID ─────────────────────────────────

export const getDMChannelId = (userA: string, userB: string): string =>
  [userA.toLowerCase(), userB.toLowerCase()].sort().join("_");

// ─── Context Definition ───────────────────────────────────────────────────────

interface SocketContextValue {
  isConnected: boolean;
  users: PresenceUser[];
  messages: Record<string, DMMessage[]>;
  sendDM: (recipientId: string, content: string) => void;
  fetchHistory: (targetUsername: string) => void;
  markRead: (channelId: string) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface SocketProviderProps {
  token: string | null;
  currentUsername: string | null;
  onAuthError: () => void;
  children: ReactNode;
}

export function SocketProvider({
  token,
  currentUsername,
  onAuthError,
  children,
}: SocketProviderProps) {
  const socketRef = useRef<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [messages, setMessages] = useState<Record<string, DMMessage[]>>({});

  useEffect(() => {
    // Don't connect without a valid token
    if (!token || !currentUsername) return;

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5001";

    const newSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      backendUrl,
      {
        auth: { token }, // JWT sent in handshake — verified by io.use() on server
        reconnectionAttempts: 5,
      },
    );

    socketRef.current = newSocket;

    // ── Connection lifecycle ───────────────────────────────────────────────
    newSocket.on("connect", () => setIsConnected(true));
    newSocket.on("disconnect", () => setIsConnected(false));

    // Server rejected the token (expired or invalid)
    newSocket.on("connect_error", (err) => {
      if (
        err.message === "AUTH_REQUIRED" ||
        err.message === "INVALID_TOKEN" ||
        err.message === "TOKEN_EXPIRED"
      ) {
        onAuthError(); // clears token in useAuth → redirects to login
        newSocket.disconnect();
      }
    });

    // ── Presence ──────────────────────────────────────────────────────────
    newSocket.on("PRESENCE_SNAPSHOT", (snapshot) => {
      setUsers(snapshot.map((u) => ({ ...u, lastSeen: new Date(u.lastSeen) })));
    });

    newSocket.on("USER_ONLINE", ({ username }) => {
      setUsers((prev) => {
        const exists = prev.find((u) => u.username === username);
        if (exists) {
          return prev.map((u) =>
            u.username === username ? { ...u, isOnline: true } : u,
          );
        }
        return [...prev, { username, isOnline: true, lastSeen: new Date() }];
      });
    });

    newSocket.on("USER_OFFLINE", ({ username, lastSeen }) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.username === username
            ? { ...u, isOnline: false, lastSeen: new Date(lastSeen) }
            : u,
        ),
      );
    });

    // ── Messages ──────────────────────────────────────────────────────────
    const appendMessage = (msg: DMMessage) => {
      const normalized = { ...msg, createdAt: new Date(msg.createdAt) };
      setMessages((prev) => {
        const channel = prev[msg.channelId] ?? [];
        // Deduplicate by _id
        if (channel.some((m) => m._id === msg._id)) return prev;
        return { ...prev, [msg.channelId]: [...channel, normalized] };
      });
    };

    newSocket.on("DM_RECEIVED", appendMessage);

    newSocket.on("DM_HISTORY", (history) => {
      if (history.length === 0) return;
      const channelId = history[0]!.channelId;
      setMessages((prev) => ({
        ...prev,
        [channelId]: history.map((m) => ({
          ...m,
          createdAt: new Date(m.createdAt),
        })),
      }));
    });

    newSocket.on("ERROR", ({ message }) => {
      console.error("[Socket error]", message);
    });

    return () => {
      newSocket.disconnect();
      if (socketRef.current === newSocket) {
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, [token, currentUsername, onAuthError]); // reconnects only when token or user changes

  // Actions
  const sendDM = useCallback((recipientId: string, content: string) => {
    socketRef.current?.emit("SEND_DM", { recipientId, content });
  }, []);

  const fetchHistory = useCallback((targetUsername: string) => {
    socketRef.current?.emit("FETCH_HISTORY", {
      targetUsername,
      limit: 50,
    });
  }, []);

  const markRead = useCallback((channelId: string) => {
    socketRef.current?.emit("MARK_READ", { channelId });
  }, []);

  const value = useMemo(
    () => ({
      isConnected,
      users,
      messages,
      sendDM,
      fetchHistory,
      markRead,
    }),
    [isConnected, users, messages, sendDM, fetchHistory, markRead],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

// ─── Hook

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocket must be used inside <SocketProvider>");
  }
  return ctx;
}
