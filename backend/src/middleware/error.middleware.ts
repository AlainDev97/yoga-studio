import type { ErrorRequestHandler } from "express";

import { AppError } from "../utils/AppError";

export const errorMiddleware: ErrorRequestHandler = (
  err: unknown,
  _req,
  res,
  _next,
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      message: err.message,
    });
    return;
  }

  console.error("Unhandled error:", err);

  res.status(500).json({
    message: "Internal server error",
  });
};
