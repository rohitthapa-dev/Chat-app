"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";

// Types

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
  REGISTER: (username: string) => void;
  SEND_DM: (payload: { recipientId: string; content: string }) => void;
  FETCH_HISTORY: (payload: { targetUsername: string; limit?: number }) => void;
  MARK_READ: (payload: { channelId: string }) => void;
}

//  Shared utility: deterministic channel ID

export const getDMChannelId = (userA: string, userB: string): string =>
  [userA.toLowerCase(), userB.toLowerCase()].sort().join("_");

// Context Definition

interface SocketContextValue {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;
  currentUser: string | null;
  users: PresenceUser[];
  messages: Record<string, DMMessage[]>; // keyed by channelId
  register: (username: string) => void;
  sendDM: (recipientId: string, content: string) => void;
  fetchHistory: (targetUsername: string) => void;
  markRead: (channelId: string) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

// Provider

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket] = useState<Socket<ServerToClientEvents, ClientToServerEvents>>(
    () => {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5001";

      return io(backendUrl, {
        autoConnect: true,
        reconnectionAttempts: 5,
      });
    },
  );
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [messages, setMessages] = useState<Record<string, DMMessage[]>>({});

  useEffect(() => {
    // ── Connection lifecycle
    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    // ── Presence
    socket.on("PRESENCE_SNAPSHOT", (snapshot) => {
      setUsers(snapshot.map((u) => ({ ...u, lastSeen: new Date(u.lastSeen) })));
    });

    socket.on("USER_ONLINE", ({ username }) => {
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

    socket.on("USER_OFFLINE", ({ username, lastSeen }) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.username === username
            ? { ...u, isOnline: false, lastSeen: new Date(lastSeen) }
            : u,
        ),
      );
    });

    // ── Messages
    const appendMessage = (msg: DMMessage) => {
      const normalized = { ...msg, createdAt: new Date(msg.createdAt) };
      setMessages((prev) => {
        const channel = prev[msg.channelId] ?? [];
        // Deduplicate by _id
        if (channel.some((m) => m._id === msg._id)) return prev;
        return { ...prev, [msg.channelId]: [...channel, normalized] };
      });
    };

    socket.on("DM_RECEIVED", appendMessage);

    socket.on("DM_HISTORY", (history) => {
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

    socket.on("ERROR", ({ message }) => {
      console.error("[Socket error]", message);
    });

    return () => {
      socket.disconnect();
    };
  }, [socket]);

  const register = useCallback(
    (username: string) => {
      const trimmed = username.trim().toLowerCase();
      setCurrentUser(trimmed);
      socket?.emit("REGISTER", trimmed);
    },
    [socket],
  );

  const sendDM = useCallback(
    (recipientId: string, content: string) => {
      socket?.emit("SEND_DM", { recipientId, content });
    },
    [socket],
  );

  const fetchHistory = useCallback(
    (targetUsername: string) => {
      socket?.emit("FETCH_HISTORY", {
        targetUsername,
        limit: 50,
      });
    },
    [socket],
  );

  const markRead = useCallback(
    (channelId: string) => {
      socket?.emit("MARK_READ", { channelId });
    },
    [socket],
  );

  const value = useMemo(
    () => ({
      socket,
      isConnected,
      currentUser,
      users,
      messages,
      register,
      sendDM,
      fetchHistory,
      markRead,
    }),
    [
      socket,
      isConnected,
      currentUser,
      users,
      messages,
      register,
      sendDM,
      fetchHistory,
      markRead,
    ],
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
