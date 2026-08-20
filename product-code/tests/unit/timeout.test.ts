import { describe, expect, it, vi } from 'vitest';
import { withTimeout } from '../../src/api/compare.js';

describe('extraction timeout', () => {
  it('aborts at the deadline and bounds cleanup grace when the operation ignores abort', async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    const pending = withTimeout(25_000, (signal) => {
      capturedSignal = signal;
      return new Promise<never>(() => undefined);
    });

    const rejection = expect(pending).rejects.toThrow('Availability extraction timed out');
    await vi.advanceTimersByTimeAsync(25_000);
    await vi.advanceTimersByTimeAsync(250);
    await rejection;
    expect(capturedSignal?.aborted).toBe(true);
    vi.useRealTimers();
  });

  it('waits for cooperative cleanup after abort before rejecting', async () => {
    vi.useFakeTimers();
    let cleaned = false;
    const pending = withTimeout(25_000, (signal) => new Promise<never>((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        cleaned = true;
        reject(new Error('browser closed'));
      }, { once: true });
    }));
    const rejection = expect(pending).rejects.toThrow('Availability extraction timed out');
    await vi.advanceTimersByTimeAsync(25_000);
    await rejection;
    expect(cleaned).toBe(true);
    vi.useRealTimers();
  });
});
