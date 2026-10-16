import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.util";

export interface AuthRequest extends Request {
  userId?: number;
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ message: "No token provided" });
    return;
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ message: "Invalid token format" });
    return;
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    res.status(401).json({
      message: "Invalid or expired token",
    });
    return;
  }

  req.userId = decoded.userId;

  next();
}
