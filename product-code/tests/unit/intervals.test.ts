import { describe, expect, it } from 'vitest';
import { coalesceIntervals, intersectAvailability } from '../../src/domain/intervals.js';

const t = (iso: string) => new Date(iso).getTime();
const iv = (start: string, end: string) => ({ start: t(start), end: t(end) });

describe('availability intervals', () => {
  it('coalesces touching and overlapping slots but not gaps', () => {
    expect(coalesceIntervals([
      iv('2026-08-20T12:30:00Z', '2026-08-20T13:00:00Z'),
      iv('2026-08-20T12:00:00Z', '2026-08-20T12:30:00Z'),
      iv('2026-08-20T14:00:00Z', '2026-08-20T14:30:00Z')
    ])).toEqual([
      iv('2026-08-20T12:00:00Z', '2026-08-20T13:00:00Z'),
      iv('2026-08-20T14:00:00Z', '2026-08-20T14:30:00Z')
    ]);
  });

  it('finds only windows shared continuously by every source for the duration', () => {
    const result = intersectAvailability([
      [iv('2026-08-20T12:00:00Z', '2026-08-20T13:00:00Z')],
      [
        iv('2026-08-20T12:00:00Z', '2026-08-20T12:30:00Z'),
        iv('2026-08-20T12:30:00Z', '2026-08-20T13:00:00Z')
      ]
    ], 60);
    expect(result).toEqual([iv('2026-08-20T12:00:00Z', '2026-08-20T13:00:00Z')]);
  });

  it('does not bridge a source gap or accept an exact-duration shortfall', () => {
    expect(intersectAvailability([
      [iv('2026-08-20T12:00:00Z', '2026-08-20T13:00:00Z')],
      [
        iv('2026-08-20T12:00:00Z', '2026-08-20T12:30:00Z'),
        iv('2026-08-20T12:31:00Z', '2026-08-20T13:00:00Z')
      ]
    ], 60)).toEqual([]);
  });

  it('rejects invalid intervals', () => {
    expect(() => coalesceIntervals([{ start: 2, end: 1 }])).toThrow(/interval/i);
  });
});
