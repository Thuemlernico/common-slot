import { describe, expect, it } from 'vitest';
import { compareRequestSchema } from '../../src/api/schema.js';

const link = (index: number) => `https://calendar.google.com/calendar/appointments/schedules/example-${index}`;
const base = {
  links: [link(1), link(2)],
  startDate: '2026-08-20',
  endDate: '2026-09-19',
  timezone: 'UTC',
  durationMinutes: 30
};

describe('compare request schema boundaries', () => {
  it('accepts exactly two and exactly ten unique links', () => {
    expect(compareRequestSchema.safeParse(base).success).toBe(true);
    expect(compareRequestSchema.safeParse({ ...base, links: Array.from({ length: 10 }, (_, index) => link(index)) }).success).toBe(true);
  });

  it('rejects fewer than two and more than ten links', () => {
    expect(compareRequestSchema.safeParse({ ...base, links: [link(1)] }).success).toBe(false);
    expect(compareRequestSchema.safeParse({ ...base, links: Array.from({ length: 11 }, (_, index) => link(index)) }).success).toBe(false);
  });

  it('rejects duplicate links before comparison', () => {
    expect(compareRequestSchema.safeParse({ ...base, links: [link(1), link(1)] }).success).toBe(false);
  });

  it('accepts a 31-day range and rejects a longer range', () => {
    expect(compareRequestSchema.safeParse(base).success).toBe(true);
    expect(compareRequestSchema.safeParse({ ...base, endDate: '2026-09-20' }).success).toBe(false);
  });

  it('rejects unknown fields and invalid duration bounds', () => {
    expect(compareRequestSchema.safeParse({ ...base, unexpected: true }).success).toBe(false);
    expect(compareRequestSchema.safeParse({ ...base, durationMinutes: 4 }).success).toBe(false);
    expect(compareRequestSchema.safeParse({ ...base, durationMinutes: 481 }).success).toBe(false);
  });
});
