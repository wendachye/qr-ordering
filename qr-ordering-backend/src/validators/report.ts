import { z } from 'zod';

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format')
  .optional();

// Sales report query. `from`/`to` are inclusive local business days; both
// default to today (a single-day Z reading). `to` defaults to `from`.
export const salesReportQuerySchema = z.object({
  from: ymd,
  to: ymd,
});

export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>;
