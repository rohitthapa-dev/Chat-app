import { Router } from "express";
import {
  getOrCreateRoom,
  getRoomMessages,
} from "../controllers/chatController.js";

const router = Router();

// Route to initiate/get a room conversation
router.post("/rooms", getOrCreateRoom);

// Route to fetch past messages for a specific room
router.get("/rooms/:roomId/messages", getRoomMessages);

export default router;
