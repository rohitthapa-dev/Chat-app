import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JWTPayload } from "../config/jwt.js";

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

const JWT_SECRET =
  process.env.JWT_SECRET ?? "change-this-secret-in-production";

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;

  if (!token) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET) as JWTPayload;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
