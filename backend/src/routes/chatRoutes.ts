import { Router } from "express";
import {
  getUserRooms,
  getOrCreateDMRoom,
  getRoomMessages,
  createGroupRoom,
  addMember,
  removeMember,
} from "../controllers/chatController.js";
import { authenticateToken } from "../middleware/authenticate.js";

const router = Router();

// Apply the auth middleware
router.use(authenticateToken);

// Get all rooms (DMs and Groups) for the current user
router.get("/rooms", getUserRooms);

// Route to initiate/get a 1-on-1 DM room
router.post("/rooms", getOrCreateDMRoom);

router.post("/rooms/group", createGroupRoom);

// Route to fetch past messages for a specific room
router.get("/rooms/:roomId/messages", getRoomMessages);

router.post("/rooms/:roomId/members", addMember); // Add this

router.delete("/rooms/:roomId/members", removeMember); // Add this

export default router;
