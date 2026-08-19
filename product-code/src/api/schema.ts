import { DateTime } from 'luxon';
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const compareRequestSchema = z.object({
  links: z.array(z.string().min(1).max(2048)).min(2).max(10).refine((items) => new Set(items).size === items.length, 'Links must be unique'),
  startDate: isoDate,
  endDate: isoDate,
  timezone: z.string().min(1).max(100).refine((zone) => DateTime.local().setZone(zone).isValid, 'Use a valid IANA timezone'),
  durationMinutes: z.number().int().min(5).max(480)
}).strict().superRefine((value, context) => {
  const start = DateTime.fromISO(value.startDate, { zone: value.timezone });
  const end = DateTime.fromISO(value.endDate, { zone: value.timezone });
  if (!start.isValid || !end.isValid || end < start) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be on or after start date' });
  } else if (end.diff(start, 'days').days > 31) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'Date range cannot exceed 31 days' });
  }
});

export type CompareRequest = z.infer<typeof compareRequestSchema>;
