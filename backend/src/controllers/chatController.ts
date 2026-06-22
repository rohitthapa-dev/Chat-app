import type { Request, Response } from "express";

export function getOrCreateRoom(_req: Request, res: Response) {
  res.status(501).json({
    error: "Room endpoints are not implemented in this chat app yet.",
  });
}

export function getRoomMessages(_req: Request, res: Response) {
  res.status(501).json({
    error: "Room message history is not implemented in this chat app yet.",
  });
}
