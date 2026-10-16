import { z } from "zod";

export const CreateSessionSchema = z.object({
  name: z.string().min(3).max(50),
  date: z.iso.date(),
  description: z.string().min(1).max(2500),
  teacherId: z.number().int().positive(),
});

export const UpdateSessionSchema = CreateSessionSchema.partial();

export type CreateSessionDto = z.infer<typeof CreateSessionSchema>;

export type UpdateSessionDto = z.infer<typeof UpdateSessionSchema>;
