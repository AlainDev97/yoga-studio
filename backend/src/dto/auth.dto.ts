import { z } from "zod";

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const RegisterSchema = z.object({
  email: z.email(),
  firstName: z.string().min(2).max(20),
  lastName: z.string().min(2).max(20),
  password: z.string().min(8),
});

export type LoginDto = z.infer<typeof LoginSchema>;
export type RegisterDto = z.infer<typeof RegisterSchema>;
