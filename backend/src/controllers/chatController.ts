import type { Response } from "express";
import Room, { findOrCreateDirectRoom } from "../models/Room.js";
import Message from "../models/Message.js";
import { type AuthRequest } from "../middleware/authenticate.js";

export async function getUserRooms(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    const rooms = await Room.find({ members: req.user.username }).sort({
      updatedAt: -1,
    });
    res.status(200).json(rooms);
  } catch (error) {
    console.error("Error fetching user rooms:", error);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
}

export async function getOrCreateDMRoom(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    const { recipientId } = req.body;
    const currentUsername = req.user.username;

    if (!recipientId)
      return res.status(400).json({ error: "Recipient ID is required" });
    if (recipientId === currentUsername)
      return res
        .status(400)
        .json({ error: "Cannot create a room with yourself" });

    const room = await findOrCreateDirectRoom(currentUsername, recipientId);
    res.status(200).json(room);
  } catch (error) {
    console.error("Error creating/finding DM room:", error);
    res.status(500).json({ error: "Failed to create or find room" });
  }
}

export async function getRoomMessages(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    const roomId = String(req.params.roomId);
    const currentUsername = req.user.username;

    const room = await Room.findById(roomId);
    if (!room || !room.members.includes(currentUsername)) {
      return res.status(403).json({ error: "Access denied to this room" });
    }

    const messages = await Message.find({ roomId }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching room messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
}

export async function createGroupRoom(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    const { name, members } = req.body;
    const currentUsername = req.user.username;

    if (!name || !members || members.length < 2) {
      return res
        .status(400)
        .json({ error: "Group name and at least 2 members are required" });
    }

    // Ensure creator is in the group
    const allMembers = Array.from(new Set([currentUsername, ...members]));

    const room = await Room.create({
      type: "group",
      name: name.trim(),
      members: allMembers,
      admins: [currentUsername], // Creator is admin
    });

    res.status(201).json(room);
  } catch (error) {
    console.error("Error creating group room:", error);
    res.status(500).json({ error: "Failed to create group" });
  }
}
