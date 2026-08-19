export interface Interval {
  /** UTC epoch milliseconds. */
  start: number;
  /** UTC epoch milliseconds, exclusive. */
  end: number;
}

function assertInterval(interval: Interval): void {
  if (!Number.isFinite(interval.start) || !Number.isFinite(interval.end) || interval.start >= interval.end) {
    throw new Error('Invalid availability interval: start must be before end');
  }
}

/** Merge overlapping or exactly touching half-open intervals. */
export function coalesceIntervals(intervals: readonly Interval[]): Interval[] {
  for (const interval of intervals) assertInterval(interval);
  const sorted = intervals.map((item) => ({ ...item })).sort((a, b) => a.start - b.start || a.end - b.end);
  const result: Interval[] = [];
  for (const current of sorted) {
    const previous = result.at(-1);
    if (previous && current.start <= previous.end) {
      previous.end = Math.max(previous.end, current.end);
    } else {
      result.push(current);
    }
  }
  return result;
}

/**
 * Intersect every source after coalescing its touching slots. Returned windows
 * preserve the full continuous overlap and are filtered by requested duration.
 */
export function intersectAvailability(sources: readonly (readonly Interval[])[], durationMinutes: number): Interval[] {
  if (sources.length < 2) throw new Error('At least two availability sources are required');
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1) throw new Error('Duration must be a positive integer');

  let common = coalesceIntervals(sources[0] ?? []);
  for (const source of sources.slice(1)) {
    const next = coalesceIntervals(source);
    const intersection: Interval[] = [];
    let left = 0;
    let right = 0;
    while (left < common.length && right < next.length) {
      const a = common[left]!;
      const b = next[right]!;
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);
      if (start < end) intersection.push({ start, end });
      if (a.end <= b.end) left += 1;
      else right += 1;
    }
    common = coalesceIntervals(intersection);
    if (common.length === 0) break;
  }

  const minimumMs = durationMinutes * 60_000;
  return common.filter(({ start, end }) => end - start >= minimumMs);
}
