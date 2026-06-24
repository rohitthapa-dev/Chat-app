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
  USER_TYPING: (payload: {
    channelId: string;
    username: string;
    isTyping: boolean;
  }) => void;
}

interface ClientToServerEvents {
  SEND_DM: (payload: { recipientId: string; content: string }) => void;
  FETCH_HISTORY: (payload: { targetUsername: string; limit?: number }) => void;
  MARK_READ: (payload: { channelId: string }) => void;
  TYPING_STATUS: (payload: { recipientId: string; isTyping: boolean }) => void;
}

// ─── Shared utility: deterministic channel ID ─────────────────────────────────

export const getDMChannelId = (userA: string, userB: string): string =>
  [userA.toLowerCase(), userB.toLowerCase()].sort().join("_");

// ─── Context Definition ───────────────────────────────────────────────────────

interface SocketContextValue {
  isConnected: boolean;
  users: PresenceUser[];
  messages: Record<string, DMMessage[]>;
  unreadCounts: Record<string, number>;
  sendDM: (recipientId: string, content: string) => void;
  fetchHistory: (targetUsername: string) => void;
  markRead: (channelId: string) => void;
  clearUnread: (channelId: string) => void;
  setActiveChannel: (channelId: string | null) => void;
  typingUsers: Record<string, string[]>;
  sendTypingStatus: (recipientId: string, isTyping: boolean) => void;
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
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Ref so DM_RECEIVED always reads the latest active channel
  // without needing the effect to be recreated on every channel switch.
  const activeChannelRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token || !currentUsername) return;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

    const newSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      backendUrl,
      {
        auth: { token },
        reconnectionAttempts: 5,
      },
    );

    socketRef.current = newSocket;

    // ── Connection lifecycle ───────────────────────────────────────────────
    newSocket.on("connect", () => setIsConnected(true));
    newSocket.on("disconnect", () => {
      setIsConnected(false);
      setTypingUsers({});
    });

    newSocket.on("connect_error", (err) => {
      if (
        err.message === "AUTH_REQUIRED" ||
        err.message === "INVALID_TOKEN" ||
        err.message === "TOKEN_EXPIRED"
      ) {
        onAuthError();
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
        if (channel.some((m) => m._id === msg._id)) return prev;
        return { ...prev, [msg.channelId]: [...channel, normalized] };
      });

      // Increment unread only when:
      // 1. Message is from someone else (not our own send echo)
      // 2. This channel is not currently open
      const isIncoming = msg.senderId !== currentUsername;
      const isActiveChannel = activeChannelRef.current === msg.channelId;

      if (isIncoming && !isActiveChannel) {
        setUnreadCounts((prev) => ({
          ...prev,
          [msg.channelId]: (prev[msg.channelId] ?? 0) + 1,
        }));
      }
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
      // History fetch means this chat was just opened — clear its badge
      setUnreadCounts((prev) => {
        if (!prev[channelId]) return prev;
        const next = { ...prev };
        next[channelId] = 0;
        return next;
      });
    });

    newSocket.on("ERROR", ({ message }) => {
      console.error("[Socket error]", message);
    });

    // ── Typing ────────────────────────────────────────────────────────────
    newSocket.on("USER_TYPING", ({ channelId, username, isTyping }) => {
      setTypingUsers((prev) => {
        const activeTypers = prev[channelId] ?? [];
        if (isTyping) {
          if (activeTypers.includes(username)) return prev;
          return { ...prev, [channelId]: [...activeTypers, username] };
        } else {
          return {
            ...prev,
            [channelId]: activeTypers.filter((u) => u !== username),
          };
        }
      });
    });

    return () => {
      newSocket.disconnect();
      if (socketRef.current === newSocket) {
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, [token, currentUsername, onAuthError]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const sendDM = useCallback((recipientId: string, content: string) => {
    socketRef.current?.emit("SEND_DM", { recipientId, content });
  }, []);

  const fetchHistory = useCallback((targetUsername: string) => {
    socketRef.current?.emit("FETCH_HISTORY", { targetUsername, limit: 50 });
  }, []);

  const markRead = useCallback((channelId: string) => {
    socketRef.current?.emit("MARK_READ", { channelId });
  }, []);

  const sendTypingStatus = useCallback(
    (recipientId: string, isTyping: boolean) => {
      socketRef.current?.emit("TYPING_STATUS", { recipientId, isTyping });
    },
    [],
  );

  // Tell the context which channel is open so DM_RECEIVED skips the unread increment
  const setActiveChannel = useCallback((channelId: string | null) => {
    activeChannelRef.current = channelId;
  }, []);

  // Zero out the badge and notify the server that messages were read
  const clearUnread = useCallback(
    (channelId: string) => {
      setUnreadCounts((prev) => {
        if (!prev[channelId]) return prev;
        const next = { ...prev };
        next[channelId] = 0;
        return next;
      });
      markRead(channelId);
    },
    [markRead],
  );

  const value = useMemo(
    () => ({
      isConnected,
      users,
      messages,
      unreadCounts,
      sendDM,
      fetchHistory,
      markRead,
      clearUnread,
      setActiveChannel,
      typingUsers,
      sendTypingStatus,
    }),
    [
      isConnected,
      users,
      messages,
      unreadCounts,
      sendDM,
      fetchHistory,
      markRead,
      clearUnread,
      setActiveChannel,
      typingUsers,
      sendTypingStatus,
    ],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocket must be used inside <SocketProvider>");
  }
  return ctx;
}
