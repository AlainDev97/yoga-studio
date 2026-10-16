import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../utils/AppError";

export const validateBody = (schema: ZodType): RequestHandler => {
  return (req, _res, next): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => issue.message)
        .join(", ");

      next(new AppError(400, message));
      return;
    }

    req.body = result.data;
    next();
  };
};
