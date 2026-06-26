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

export interface ChatMessage {
  _id: string;
  roomId: string;
  senderId: string;
  content: string;
  readBy: string[];
  createdAt: Date;
}

export interface Room {
  _id: string;
  type: "direct" | "group";
  name?: string;
  members: string[];
  admins: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface ServerToClientEvents {
  USER_ONLINE: (payload: { username: string }) => void;
  USER_OFFLINE: (payload: { username: string; lastSeen: Date }) => void;
  PRESENCE_SNAPSHOT: (users: PresenceUser[]) => void;
  MESSAGE_RECEIVED: (message: ChatMessage) => void;
  MESSAGE_HISTORY: (messages: ChatMessage[]) => void;
  NOTIFY_ROOM_CREATED: (room: Room) => void;
  NOTIFY_ROOM_UPDATED: (room: Room) => void;
  ERROR: (payload: { message: string }) => void;
  USER_TYPING: (payload: {
    roomId: string;
    username: string;
    isTyping: boolean;
  }) => void;
}

interface ClientToServerEvents {
  SEND_MESSAGE: (payload: { roomId: string; content: string }) => void;
  FETCH_HISTORY: (payload: { roomId: string; limit?: number }) => void;
  MARK_READ: (payload: { roomId: string }) => void;
  TYPING_STATUS: (payload: { roomId: string; isTyping: boolean }) => void;
  NOTIFY_ROOM_CREATED: (room: Room) => void;
  NOTIFY_ROOM_UPDATED: (room: Room) => void;
}

// ─── Context Definition ───────────────────────────────────────────────────────

interface SocketContextValue {
  isConnected: boolean;
  users: PresenceUser[];
  rooms: Room[];
  messages: Record<string, ChatMessage[]>;
  unreadCounts: Record<string, number>;
  sendMessage: (roomId: string, content: string) => void;
  fetchHistory: (roomId: string) => void;
  markRead: (roomId: string) => void;
  clearUnread: (roomId: string) => void;
  setActiveRoom: (roomId: string | null) => void;
  typingUsers: Record<string, string[]>;
  sendTypingStatus: (roomId: string, isTyping: boolean) => void;
  createDMRoom: (recipientId: string) => Promise<Room | null>;
  createGroupRoom: (name: string, members: string[]) => Promise<Room | null>;
  addMember: (roomId: string, username: string) => Promise<Room | null>;
  removeMember: (roomId: string, username: string) => Promise<Room | null>;
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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const activeRoomRef = useRef<string | null>(null);

  const fetchRooms = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chat/rooms`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (err) {
      console.error("Failed to fetch rooms", err);
    }
  }, [token]);

  useEffect(() => {
    if (!token || !currentUsername) return;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const newSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      backendUrl,
      { auth: { token }, reconnectionAttempts: 5 },
    );

    socketRef.current = newSocket;

    newSocket.on("connect", () => {
      setIsConnected(true);
      fetchRooms();
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
      setTypingUsers({});
    });

    newSocket.on("connect_error", (err) => {
      if (
        ["AUTH_REQUIRED", "INVALID_TOKEN", "TOKEN_EXPIRED"].includes(
          err.message,
        )
      ) {
        onAuthError();
        newSocket.disconnect();
      }
    });

    newSocket.on("PRESENCE_SNAPSHOT", (snapshot) => {
      setUsers(snapshot.map((u) => ({ ...u, lastSeen: new Date(u.lastSeen) })));
    });

    newSocket.on("USER_ONLINE", ({ username }) => {
      setUsers((prev) => {
        const exists = prev.find((u) => u.username === username);
        if (exists)
          return prev.map((u) =>
            u.username === username ? { ...u, isOnline: true } : u,
          );
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

    const appendMessage = (msg: ChatMessage) => {
      const normalized = { ...msg, createdAt: new Date(msg.createdAt) };
      setMessages((prev) => {
        const roomMessages = prev[msg.roomId] ?? [];
        if (roomMessages.some((m) => m._id === msg._id)) return prev;
        return { ...prev, [msg.roomId]: [...roomMessages, normalized] };
      });

      const isIncoming = msg.senderId !== currentUsername;
      const isActiveRoom = activeRoomRef.current === msg.roomId;

      if (isIncoming && !isActiveRoom) {
        setUnreadCounts((prev) => ({
          ...prev,
          [msg.roomId]: (prev[msg.roomId] ?? 0) + 1,
        }));
      }
    };

    newSocket.on("MESSAGE_RECEIVED", appendMessage);

    newSocket.on("MESSAGE_HISTORY", (history) => {
      if (history.length === 0) return;
      const roomId = history[0]!.roomId;
      setMessages((prev) => ({
        ...prev,
        [roomId]: history.map((m) => ({
          ...m,
          createdAt: new Date(m.createdAt),
        })),
      }));
      setUnreadCounts((prev) => {
        if (!prev[roomId]) return prev;
        return { ...prev, [roomId]: 0 };
      });
    });

    newSocket.on("ERROR", ({ message }) =>
      console.error("[Socket error]", message),
    );

    newSocket.on("USER_TYPING", ({ roomId, username, isTyping }) => {
      setTypingUsers((prev) => {
        const activeTypers = prev[roomId] ?? [];
        if (isTyping) {
          if (activeTypers.includes(username)) return prev;
          return { ...prev, [roomId]: [...activeTypers, username] };
        } else {
          return {
            ...prev,
            [roomId]: activeTypers.filter((u) => u !== username),
          };
        }
      });
    });

    // Listen for new rooms (groups or DMs) created by other users
    newSocket.on("NOTIFY_ROOM_CREATED", (room) => {
      setRooms((prev) => {
        if (prev.find((r) => r._id === room._id)) return prev;
        return [room, ...prev];
      });
    });

    // Listen for room updates (members added/removed)
    newSocket.on("NOTIFY_ROOM_UPDATED", (updatedRoom) => {
      setRooms((prev) =>
        prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r)),
      );
    });

    return () => {
      newSocket.disconnect();
      if (socketRef.current === newSocket) socketRef.current = null;
      setIsConnected(false);
    };
  }, [token, currentUsername, onAuthError, fetchRooms]);

  const sendMessage = useCallback((roomId: string, content: string) => {
    socketRef.current?.emit("SEND_MESSAGE", { roomId, content });
  }, []);

  const fetchHistory = useCallback((roomId: string) => {
    socketRef.current?.emit("FETCH_HISTORY", { roomId, limit: 50 });
  }, []);

  const markRead = useCallback((roomId: string) => {
    socketRef.current?.emit("MARK_READ", { roomId });
  }, []);

  const sendTypingStatus = useCallback((roomId: string, isTyping: boolean) => {
    socketRef.current?.emit("TYPING_STATUS", { roomId, isTyping });
  }, []);

  const setActiveRoom = useCallback((roomId: string | null) => {
    activeRoomRef.current = roomId;
  }, []);

  const clearUnread = useCallback(
    (roomId: string) => {
      setUnreadCounts((prev) => {
        if (!prev[roomId]) return prev;
        return { ...prev, [roomId]: 0 };
      });
      markRead(roomId);
    },
    [markRead],
  );

  const createDMRoom = useCallback(
    async (recipientId: string): Promise<Room | null> => {
      if (!token) return null;
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chat/rooms`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ recipientId }),
          },
        );
        if (res.ok) {
          const newRoom: Room = await res.json();
          setRooms((prev) => {
            if (prev.find((r) => r._id === newRoom._id)) return prev;
            return [newRoom, ...prev];
          });
          return newRoom;
        }
        return null;
      } catch (err) {
        console.error("Failed to create room", err);
        return null;
      }
    },
    [token],
  );

  const createGroupRoom = useCallback(
    async (name: string, members: string[]): Promise<Room | null> => {
      if (!token) return null;
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chat/rooms/group`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name, members }),
          },
        );
        if (res.ok) {
          const newRoom: Room = await res.json();
          setRooms((prev) => {
            if (prev.find((r) => r._id === newRoom._id)) return prev;
            return [newRoom, ...prev];
          });
          // Tell server to connect everyone via sockets
          socketRef.current?.emit("NOTIFY_ROOM_CREATED", newRoom);
          return newRoom;
        }
        return null;
      } catch (err) {
        console.error("Failed to create group room", err);
        return null;
      }
    },
    [token],
  );

  const addMember = useCallback(
    async (roomId: string, username: string): Promise<Room | null> => {
      if (!token) return null;
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chat/rooms/${roomId}/members`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ username }),
          },
        );
        if (res.ok) {
          const updatedRoom: Room = await res.json();
          setRooms((prev) =>
            prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r)),
          );
          socketRef.current?.emit("NOTIFY_ROOM_UPDATED", updatedRoom);
          return updatedRoom;
        }
        return null;
      } catch (err) {
        console.error("Failed to add member", err);
        return null;
      }
    },
    [token],
  );

  const removeMember = useCallback(
    async (roomId: string, username: string): Promise<Room | null> => {
      if (!token) return null;
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chat/rooms/${roomId}/members`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ username }),
          },
        );
        if (res.ok) {
          const updatedRoom: Room = await res.json();
          setRooms((prev) =>
            prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r)),
          );
          socketRef.current?.emit("NOTIFY_ROOM_UPDATED", updatedRoom);
          return updatedRoom;
        }
        return null;
      } catch (err) {
        console.error("Failed to remove member", err);
        return null;
      }
    },
    [token],
  );

  const value = useMemo(
    () => ({
      isConnected,
      users,
      rooms,
      messages,
      unreadCounts,
      sendMessage,
      fetchHistory,
      markRead,
      clearUnread,
      setActiveRoom,
      typingUsers,
      sendTypingStatus,
      createDMRoom,
      createGroupRoom,
      addMember,
      removeMember,
    }),
    [
      isConnected,
      users,
      rooms,
      messages,
      unreadCounts,
      sendMessage,
      fetchHistory,
      markRead,
      clearUnread,
      setActiveRoom,
      typingUsers,
      sendTypingStatus,
      createDMRoom,
      createGroupRoom,
      addMember,
      removeMember,
    ],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used inside <SocketProvider>");
  return ctx;
}
