import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { Server, Socket } from "socket.io";
import connectDB from "./config/db.js";
import User from "./models/User.js";
import Message, { getDMChannelId } from "./models/Message.js";
import authRouter from "./routes/auth.js";
import { verifyToken, type JWTPayload } from "./config/jwt.js";

// Types
interface ServerToClientEvents {
  USER_ONLINE: (payload: { username: string }) => void;
  USER_OFFLINE: (payload: { username: string; lastSeen: Date }) => void;
  PRESENCE_SNAPSHOT: (users: PresenceUser[]) => void;
  DM_RECEIVED: (message: SerializedMessage) => void;
  DM_HISTORY: (messages: SerializedMessage[]) => void;
  ERROR: (payload: { message: string }) => void;
  USER_TYPING: (payload: {
    channelId: string;
    username: string;
    isTyping: boolean;
  }) => void;
}

interface ClientToServerEvents {
  SEND_DM: (payload: SendDMPayload) => void;
  FETCH_HISTORY: (payload: FetchHistoryPayload) => void;
  MARK_READ: (payload: { channelId: string }) => void;
  TYPING_STATUS: (payload: { recipientId: string; isTyping: boolean }) => void;
}

interface SendDMPayload {
  recipientId: string;
  content: string;
}

interface FetchHistoryPayload {
  targetUsername: string;
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
  senderId: string;
  recipientId: string;
  channelId: string;
  content: string;
  read: boolean;
  createdAt: Date;
}

interface SocketData {
  user: JWTPayload; // { userId, username }
}

//  Maps: socket ↔ username

const socketToUser = new Map<string, string>();
const userToSocket = new Map<string, string>();

//  App Setup

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

//  REST: Health

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// REST: Auth

app.use("/api/auth", authRouter);

//  REST: All Users

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

  if (!token) {
    return next(new Error("AUTH_REQUIRED"));
  }

  try {
    const payload = verifyToken(token);
    socket.data.user = payload;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return next(new Error("TOKEN_EXPIRED"));
    }
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

    socketToUser.set(socket.id, username);
    userToSocket.set(username, socket.id);
    void socket.join(username);

    try {
      // Step 1: mark this user online — MUST be awaited first
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: new Date(),
      });

      // Step 2: fetch snapshot AFTER the write is committed
      // so this user appears as online in their own sidebar too
      const allUsers = await User.find(
        {},
        { username: 1, isOnline: 1, lastSeen: 1, _id: 0 },
      );
      socket.emit("PRESENCE_SNAPSHOT", allUsers as PresenceUser[]);

      // Step 3: tell everyone else this user is online
      socket.broadcast.emit("USER_ONLINE", { username });
    } catch (err) {
      console.error("Connection setup error:", err);
    }

    // ── SEND_DM
    socket.on("SEND_DM", async ({ recipientId, content }: SendDMPayload) => {
      if (!recipientId || !content?.trim()) {
        socket.emit("ERROR", { message: "Invalid message payload." });
        return;
      }

      if (username === recipientId.toLowerCase()) {
        socket.emit("ERROR", { message: "Cannot send a DM to yourself." });
        return;
      }

      const channelId = getDMChannelId(username, recipientId);

      try {
        const saved = await Message.create({
          senderId: username,
          recipientId: recipientId.toLowerCase(),
          channelId,
          content: content.trim(),
          read: false,
        });

        const serialized: SerializedMessage = {
          _id: String(saved._id),
          senderId: saved.senderId,
          recipientId: saved.recipientId,
          channelId: saved.channelId,
          content: saved.content,
          read: saved.read,
          createdAt: saved.createdAt,
        };

        socket.emit("DM_RECEIVED", serialized);
        io.to(recipientId.toLowerCase()).emit("DM_RECEIVED", serialized);
      } catch (err) {
        console.error("SEND_DM error:", err);
        socket.emit("ERROR", { message: "Message delivery failed." });
      }
    });

    // ── FETCH_HISTORY
    socket.on(
      "FETCH_HISTORY",
      async ({ targetUsername, limit = 50, before }: FetchHistoryPayload) => {
        const channelId = getDMChannelId(username, targetUsername);

        try {
          const query: Record<string, unknown> = { channelId };

          if (before) {
            query["createdAt"] = { $lt: new Date(before) };
          }

          const messages = await Message.find(query)
            .sort({ createdAt: 1 })
            .limit(Math.min(limit, 100))
            .lean();

          const serialized: SerializedMessage[] = messages.map((m) => ({
            _id: String(m._id),
            senderId: m.senderId,
            recipientId: m.recipientId,
            channelId: m.channelId,
            content: m.content,
            read: m.read,
            createdAt: m.createdAt,
          }));

          socket.emit("DM_HISTORY", serialized);
        } catch (err) {
          console.error("FETCH_HISTORY error:", err);
          socket.emit("ERROR", { message: "Could not load message history." });
        }
      },
    );

    // ── MARK_READ
    socket.on("MARK_READ", async ({ channelId }: { channelId: string }) => {
      try {
        await Message.updateMany(
          { channelId, recipientId: username, read: false },
          { read: true },
        );
      } catch (err) {
        console.error("MARK_READ error:", err);
      }
    });

    // ── TYPING_STATUS
    socket.on("TYPING_STATUS", ({ recipientId, isTyping }) => {
      if (!recipientId) return;

      const targetRoom = recipientId.toLowerCase();
      const channelId = getDMChannelId(username, targetRoom);

      // Forward typing status to the recipient's personal socket room
      io.to(targetRoom).emit("USER_TYPING", {
        channelId,
        username, // The person who is typing
        isTyping,
      });
    });

    // DISCONNECT
    socket.on("disconnect", async () => {
      socketToUser.delete(socket.id);
      userToSocket.delete(username);

      const lastSeen = new Date();

      try {
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
      } catch (err) {
        console.error("Presence cleanup error:", err);
      }

      io.emit("USER_OFFLINE", { username, lastSeen });
      console.log(`👋 Disconnected: ${username} (${socket.id})`);
    });
  },
);

// Start
const PORT = Number(process.env.PORT) || 5001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
