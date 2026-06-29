import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { Server, Socket } from "socket.io";
import connectDB from "./config/db.js";
import User from "./models/User.js";
import Room from "./models/Room.js";
import Message from "./models/Message.js";
import authRouter from "./routes/auth.js";
import { verifyToken, type JWTPayload } from "./config/jwt.js";

// Types
interface ServerToClientEvents {
  USER_ONLINE: (payload: { username: string }) => void;
  USER_OFFLINE: (payload: { username: string; lastSeen: Date }) => void;
  PRESENCE_SNAPSHOT: (users: PresenceUser[]) => void;
  MESSAGE_RECEIVED: (message: SerializedMessage) => void;
  MESSAGE_HISTORY: (messages: SerializedMessage[]) => void;
  NOTIFY_ROOM_CREATED: (room: SerializedRoom) => void;
  NOTIFY_ROOM_UPDATED: (room: SerializedRoom) => void;
  ERROR: (payload: { message: string }) => void;
  USER_TYPING: (payload: {
    roomId: string;
    username: string;
    isTyping: boolean;
  }) => void;
  MESSAGES_READ: (payload: { roomId: string; reader: string }) => void;
}

interface ClientToServerEvents {
  SEND_MESSAGE: (payload: SendMessagePayload) => void;
  FETCH_HISTORY: (payload: FetchHistoryPayload) => void;
  MARK_READ: (payload: { roomId: string }) => void;
  TYPING_STATUS: (payload: { roomId: string; isTyping: boolean }) => void;
  NOTIFY_ROOM_CREATED: (room: SerializedRoom) => void;
  NOTIFY_ROOM_UPDATED: (room: SerializedRoom) => void;
}

interface SendMessagePayload {
  roomId: string;
  content: string;
}

interface FetchHistoryPayload {
  roomId: string;
  limit?: number;
  before?: string;
}

interface PresenceUser {
  username: string;
  isOnline: boolean;
  lastSeen: Date;
}

interface SerializedMessage {
  _id: string;
  roomId: string;
  senderId: string;
  content: string;
  readBy: string[];
  createdAt: Date;
}

interface SerializedRoom {
  _id: string;
  type: "direct" | "group";
  name?: string;
  members: string[];
  admins: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface SocketData {
  user: JWTPayload; // { userId, username }
}

// App Setup
await connectDB();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" }));
app.use(express.json());

const httpServer = http.createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// REST: Health
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// REST: Auth
app.use("/api/auth", authRouter);

// REST: Chat Routes
import chatRouter from "./routes/chatRoutes.js";
app.use("/api/chat", chatRouter);

// REST: All Users
app.get("/api/users", async (_req, res) => {
  try {
    const users = await User.find(
      {},
      { username: 1, isOnline: 1, lastSeen: 1, _id: 0 },
    ).sort({ isOnline: -1, username: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Socket.IO: Auth Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return next(new Error("AUTH_REQUIRED"));

  try {
    const payload = verifyToken(token);
    socket.data.user = payload;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError")
      return next(new Error("TOKEN_EXPIRED"));
    return next(new Error("INVALID_TOKEN"));
  }
});

// Socket.IO: Core Event Loop
io.on(
  "connection",
  async (
    socket: Socket<
      ClientToServerEvents,
      ServerToClientEvents,
      Record<string, never>,
      SocketData
    >,
  ) => {
    const { userId, username } = socket.data.user;
    console.log(`🔌 Socket connected: ${username} (${socket.id})`);

    // Keep personal room for presence/direct user targeting
    void socket.join(username);

    try {
      // 1. Check how many sockets this user already has connected
      //    If this is their first socket, mark them online and broadcast
      const existingSockets = await io.in(username).fetchSockets();
      const isFirstConnection = existingSockets.length === 1; // current socket is already in the room

      if (isFirstConnection) {
        await User.findByIdAndUpdate(userId, {
          isOnline: true,
          lastSeen: new Date(),
        });
        // Broadcast to everyone else that this user came online
        socket.broadcast.emit("USER_ONLINE", { username });
        console.log(`✅ ${username} is now online (first socket)`);
      } else {
        console.log(
          `➕ ${username} opened another tab (${existingSockets.length} sockets total)`,
        );
      }

      // 2. Always send presence snapshot to the newly connected socket
      //    regardless of whether it's the first or nth connection
      const allUsers = await User.find(
        {},
        { username: 1, isOnline: 1, lastSeen: 1, _id: 0 },
      );
      socket.emit("PRESENCE_SNAPSHOT", allUsers as PresenceUser[]);

      // 3. Join user to all their Room documents
      const userRooms = await Room.find({ members: username }).select("_id");
      userRooms.forEach((room) => {
        void socket.join(room._id.toString());
      });
      console.log(`📦 Joined ${userRooms.length} rooms for ${username}`);
    } catch (err) {
      console.error("Connection setup error:", err);
    }

    // ── NOTIFY_ROOM_CREATED
    socket.on("NOTIFY_ROOM_CREATED", async (room: SerializedRoom) => {
      try {
        // Join all active sockets of the members to this new room
        for (const member of room.members) {
          const memberSockets = await io.in(member).fetchSockets();
          memberSockets.forEach((s) => s.join(room._id));
        }

        // Notify all members to update their sidebar
        room.members.forEach((member) => {
          io.to(member).emit("NOTIFY_ROOM_CREATED", room);
        });
      } catch (err) {
        console.error("NOTIFY_ROOM_CREATED error:", err);
      }
    });

    // ── NOTIFY_ROOM_UPDATED
    socket.on("NOTIFY_ROOM_UPDATED", async (room: SerializedRoom) => {
      try {
        // Ensure sockets are dynamically joined to the room (handles newly added members)
        for (const member of room.members) {
          const memberSockets = await io.in(member).fetchSockets();
          memberSockets.forEach((s) => s.join(room._id));
        }

        // Notify all members to update their sidebar and group info
        room.members.forEach((member) => {
          io.to(member).emit("NOTIFY_ROOM_UPDATED", room);
        });
      } catch (err) {
        console.error("NOTIFY_ROOM_UPDATED error:", err);
      }
    });

    // ── SEND_MESSAGE
    socket.on(
      "SEND_MESSAGE",
      async ({ roomId, content }: SendMessagePayload) => {
        if (!roomId || !content?.trim()) {
          socket.emit("ERROR", { message: "Invalid message payload." });
          return;
        }

        try {
          // 1. Verify sender is a member of the room
          const room = await Room.findById(roomId);
          if (!room || !room.members.includes(username)) {
            socket.emit("ERROR", { message: "Access denied to this room." });
            return;
          }

          // 2. Ensure sockets are dynamically joined to the room
          await socket.join(roomId);
          if (room.type === "direct") {
            const recipient = room.members.find((m) => m !== username);
            if (recipient) {
              const recipientSockets = await io.in(recipient).fetchSockets();
              recipientSockets.forEach((s) => s.join(roomId));
            }
          }

          // 3. Save the message
          const saved = await Message.create({
            roomId: room._id,
            senderId: username,
            content: content.trim(),
            readBy: [username],
          });

          const serialized: SerializedMessage = {
            _id: String(saved._id),
            roomId: String(saved.roomId),
            senderId: saved.senderId,
            content: saved.content,
            readBy: saved.readBy,
            createdAt: saved.createdAt,
          };

          // 4. Emit to everyone in the room (including sender for UI confirmation)
          io.to(roomId).emit("MESSAGE_RECEIVED", serialized);
        } catch (err) {
          console.error("SEND_MESSAGE error:", err);
          socket.emit("ERROR", { message: "Message delivery failed." });
        }
      },
    );

    // ── FETCH_HISTORY
    socket.on(
      "FETCH_HISTORY",
      async ({ roomId, limit = 50, before }: FetchHistoryPayload) => {
        if (!roomId) return;

        try {
          const query: Record<string, unknown> = { roomId };
          if (before) {
            query["createdAt"] = { $lt: new Date(before) };
          }

          const messages = await Message.find(query)
            .sort({ createdAt: 1 })
            .limit(Math.min(limit, 100))
            .lean();

          const serialized: SerializedMessage[] = messages.map((m) => ({
            _id: String(m._id),
            roomId: String(m.roomId),
            senderId: m.senderId,
            content: m.content,
            readBy: m.readBy,
            createdAt: m.createdAt,
          }));

          socket.emit("MESSAGE_HISTORY", serialized);
        } catch (err) {
          console.error("FETCH_HISTORY error:", err);
          socket.emit("ERROR", { message: "Could not load message history." });
        }
      },
    );

    // ── MARK_READ
    socket.on("MARK_READ", async ({ roomId }: { roomId: string }) => {
      if (!roomId) return;
      try {
        const result = await Message.updateMany(
          { roomId, readBy: { $ne: username } },
          { $addToSet: { readBy: username } },
        );

        // Only broadcast if there were actually unread messages to mark.
        // This avoids noisy no-op events on every room switch.
        if (result.modifiedCount > 0) {
          // Notify everyone else in the room so their UI can flip "Sent" -> "Seen"
          socket.to(roomId).emit("MESSAGES_READ", { roomId, reader: username });
        }
      } catch (err) {
        console.error("MARK_READ error:", err);
      }
    });

    // ── TYPING_STATUS
    socket.on("TYPING_STATUS", ({ roomId, isTyping }) => {
      if (!roomId) return;
      socket.to(roomId).emit("USER_TYPING", {
        roomId,
        username,
        isTyping,
      });
    });

    // ── DISCONNECT
    socket.on("disconnect", async () => {
      const lastSeen = new Date();

      try {
        // Wait a tick for Socket.IO to fully remove this socket from all rooms
        // before counting remaining sockets for this user
        await new Promise((resolve) => setTimeout(resolve, 100));

        const remainingSockets = await io.in(username).fetchSockets();

        if (remainingSockets.length === 0) {
          // This was the last socket — user is truly offline
          await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
          io.emit("USER_OFFLINE", { username, lastSeen });
          console.log(`👋 ${username} is now offline (last socket closed)`);
        } else {
          // User still has other tabs/sockets open — don't mark offline
          console.log(
            `➖ ${username} closed a tab (${remainingSockets.length} sockets remaining)`,
          );
        }
      } catch (err) {
        console.error("Presence cleanup error:", err);
        // Fallback: mark offline anyway to avoid stuck-online state
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen,
        }).catch(() => {});
        io.emit("USER_OFFLINE", { username, lastSeen });
      }

      console.log(`🔌 Disconnected: ${username} (${socket.id})`);
    });
  },
);

// Start
const PORT = Number(process.env.PORT) || 5001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
