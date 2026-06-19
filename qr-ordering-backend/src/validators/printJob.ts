import { z } from 'zod';

export const markFailedSchema = z.object({
  error: z.string().trim().min(1, 'error message is required').max(1000),
});

export type MarkFailedInput = z.infer<typeof markFailedSchema>;
