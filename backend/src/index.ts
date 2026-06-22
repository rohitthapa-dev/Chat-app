import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { Server, Socket } from "socket.io";
import connectDB from "./config/db.js";
import User from "./models/User.js";
import Message, { getDMChannelId } from "./models/Message.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServerToClientEvents {
  USER_ONLINE: (payload: { username: string }) => void;
  USER_OFFLINE: (payload: { username: string; lastSeen: Date }) => void;
  PRESENCE_SNAPSHOT: (users: PresenceUser[]) => void;
  DM_RECEIVED: (message: SerializedMessage) => void;
  DM_HISTORY: (messages: SerializedMessage[]) => void;
  ERROR: (payload: { message: string }) => void;
}

interface ClientToServerEvents {
  REGISTER: (username: string) => void;
  SEND_DM: (payload: SendDMPayload) => void;
  FETCH_HISTORY: (payload: FetchHistoryPayload) => void;
  MARK_READ: (payload: { channelId: string }) => void;
}

interface SendDMPayload {
  recipientId: string;
  content: string;
}

interface FetchHistoryPayload {
  targetUsername: string;
  limit?: number;
  before?: string; // ISO date string for pagination
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

// ─── Maps: socket ↔ username ──────────────────────────────────────────────────

// Maps socketId → username (for disconnect cleanup)
const socketToUser = new Map<string, string>();
// Maps username → socketId (for targeted DM delivery)
const userToSocket = new Map<string, string>();

// ─── App Setup ────────────────────────────────────────────────────────────────

await connectDB();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" }));
app.use(express.json());

const httpServer = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// ─── REST: Health ─────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── REST: All Users (for friend list on load) ────────────────────────────────

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

// ─── Socket.IO: Core Event Loop ───────────────────────────────────────────────

io.on(
  "connection",
  (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── REGISTER ──────────────────────────────────────────────────────────────
    socket.on("REGISTER", async (username: string) => {
      if (!username || typeof username !== "string") {
        socket.emit("ERROR", { message: "Invalid username." });
        return;
      }

      const sanitized = username.trim().toLowerCase();

      try {
        // Upsert: create or update user, mark online
        await User.findOneAndUpdate(
          { username: sanitized },
          { isOnline: true, lastSeen: new Date() },
          { upsert: true, new: true },
        );

        // Register bidirectional maps
        socketToUser.set(socket.id, sanitized);
        userToSocket.set(sanitized, socket.id);

        // Join personal room for targeted delivery
        void socket.join(sanitized);

        console.log(`👤 Registered: ${sanitized} (${socket.id})`);

        // Send full presence snapshot to the newly connected user
        const allUsers = await User.find(
          {},
          { username: 1, isOnline: 1, lastSeen: 1, _id: 0 },
        );
        socket.emit("PRESENCE_SNAPSHOT", allUsers as PresenceUser[]);

        // Broadcast USER_ONLINE to all OTHER connected sockets
        socket.broadcast.emit("USER_ONLINE", { username: sanitized });
      } catch (err) {
        console.error("REGISTER error:", err);
        socket.emit("ERROR", { message: "Registration failed. Try again." });
      }
    });

    // ── SEND_DM ───────────────────────────────────────────────────────────────
    socket.on("SEND_DM", async ({ recipientId, content }: SendDMPayload) => {
      const senderId = socketToUser.get(socket.id);

      if (!senderId) {
        socket.emit("ERROR", { message: "Not registered. Please reconnect." });
        return;
      }

      if (!recipientId || !content?.trim()) {
        socket.emit("ERROR", { message: "Invalid message payload." });
        return;
      }

      if (senderId === recipientId.toLowerCase()) {
        socket.emit("ERROR", { message: "Cannot send a DM to yourself." });
        return;
      }

      const channelId = getDMChannelId(senderId, recipientId);

      try {
        // Persist to Atlas
        const saved = await Message.create({
          senderId,
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

        // Echo back to sender (their own chat window updates)
        socket.emit("DM_RECEIVED", serialized);

        // Deliver to recipient's personal room (handles multi-tab too)
        io.to(recipientId.toLowerCase()).emit("DM_RECEIVED", serialized);
      } catch (err) {
        console.error("SEND_DM error:", err);
        socket.emit("ERROR", { message: "Message delivery failed." });
      }
    });

    // ── FETCH_HISTORY ─────────────────────────────────────────────────────────
    socket.on(
      "FETCH_HISTORY",
      async ({ targetUsername, limit = 50, before }: FetchHistoryPayload) => {
        const requestingUser = socketToUser.get(socket.id);

        if (!requestingUser) {
          socket.emit("ERROR", { message: "Not registered." });
          return;
        }

        const channelId = getDMChannelId(requestingUser, targetUsername);

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

    // ── MARK_READ ─────────────────────────────────────────────────────────────
    socket.on("MARK_READ", async ({ channelId }: { channelId: string }) => {
      const username = socketToUser.get(socket.id);
      if (!username) return;

      try {
        await Message.updateMany(
          { channelId, recipientId: username, read: false },
          { read: true },
        );
      } catch (err) {
        console.error("MARK_READ error:", err);
      }
    });

    // ── DISCONNECT ────────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      const username = socketToUser.get(socket.id);

      if (username) {
        socketToUser.delete(socket.id);
        userToSocket.delete(username);

        const lastSeen = new Date();

        try {
          await User.findOneAndUpdate(
            { username },
            { isOnline: false, lastSeen },
          );
        } catch (err) {
          console.error("Presence cleanup error:", err);
        }

        // Broadcast USER_OFFLINE with lastSeen to all remaining peers
        io.emit("USER_OFFLINE", { username, lastSeen });
        console.log(`👋 Disconnected: ${username} (${socket.id})`);
      }
    });
  },
);

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 5001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
