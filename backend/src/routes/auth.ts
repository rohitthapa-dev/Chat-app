import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { signToken } from "../config/jwt.js";
import { authenticateToken } from "../middleware/authenticate.js";
import type { AuthRequest } from "../middleware/authenticate.js";

const router = Router();

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({ message: "Username and password are required" });
    return;
  }

  const trimmed = username.trim().toLowerCase();

  if (trimmed.length < 3 || trimmed.length > 20) {
    res.status(400).json({ message: "Username must be 3–20 characters" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ message: "Password must be at least 6 characters" });
    return;
  }

  try {
    const existing = await User.findOne({ username: trimmed });
    if (existing) {
      res.status(409).json({ message: "Username already taken" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username: trimmed, passwordHash });

    const token = signToken({
      userId: user._id.toString(),
      username: user.username,
    });

    res.status(201).json({
      token,
      user: { userId: user._id, username: user.username },
    });
  } catch (err) {
    console.error("[register]", err);
    res.status(500).json({ message: "Server error" });
  }
});

//  POST /api/auth/login
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({ message: "Username and password are required" });
    return;
  }

  try {
    const user = await User.findOne({
      username: username.trim().toLowerCase(),
    });

    // Generic message — don't reveal whether the username exists
    if (!user) {
      res.status(401).json({ message: "Invalid username or password" });
      return;
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      res.status(401).json({ message: "Invalid username or password" });
      return;
    }

    const token = signToken({
      userId: user._id.toString(),
      username: user.username,
    });

    res.json({
      token,
      user: { userId: user._id, username: user.username },
    });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/auth/me
router.get(
  "/me",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await User.findById(req.user!.userId).select(
        "-passwordHash",
      );
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      res.json({ user: { userId: user._id, username: user.username } });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  },
);

export default router;
