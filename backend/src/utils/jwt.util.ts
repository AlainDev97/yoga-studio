import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-key";

export interface JwtPayload {
  userId: number;
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: "24h",
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded: unknown = jwt.verify(token, JWT_SECRET);

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("userId" in decoded) ||
      typeof decoded.userId !== "number" ||
      !Number.isSafeInteger(decoded.userId) ||
      decoded.userId <= 0
    ) {
      return null;
    }

    return { userId: decoded.userId };
  } catch {
    return null;
  }
}
