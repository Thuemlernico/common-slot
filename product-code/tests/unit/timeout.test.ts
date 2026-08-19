import { describe, expect, it, vi } from 'vitest';
import { withTimeout } from '../../src/api/compare.js';

describe('extraction timeout', () => {
  it('rejects at the deadline even when the operation ignores the abort signal', async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    const pending = withTimeout(25_000, (signal) => {
      capturedSignal = signal;
      return new Promise<never>(() => undefined);
    });

    const rejection = expect(pending).rejects.toThrow('Availability extraction timed out');
    await vi.advanceTimersByTimeAsync(25_000);
    await rejection;
    expect(capturedSignal?.aborted).toBe(true);
    vi.useRealTimers();
  });
});
