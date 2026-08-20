import { describe, expect, it, vi } from 'vitest';
import { ProviderAvailabilityExtractor } from '../../src/providers/router.js';
import { CalComAvailabilityExtractor } from '../../src/providers/calcom.js';
import type { AvailabilityExtractor } from '../../src/providers/types.js';

const options = { timezone: 'UTC', startDate: '2026-08-20', endDate: '2026-08-27' };
const result = { intervals: [], appointmentDurationMinutes: 30, canonicalUrl: 'https://example.invalid/canonical' };
const fake = (): AvailabilityExtractor => ({ extract: vi.fn(async () => result) });

describe('provider extractor router', () => {
  it.each([
    ['https://calendar.google.com/calendar/appointments/schedules/a', 'google'],
    ['https://calendly.com/example/30min', 'calendly'],
    ['https://cal.com/example/30min', 'calcom'],
    ['https://i.cal.com/example/30min', 'calcom']
  ] as const)('routes %s to the %s adapter', async (url, selected) => {
    const adapters = { google: fake(), calendly: fake(), calcom: fake() };
    const router = new ProviderAvailabilityExtractor(adapters);
    await router.extract(url, options);
    for (const [name, adapter] of Object.entries(adapters)) {
      expect(adapter.extract).toHaveBeenCalledTimes(name === selected ? 1 : 0);
    }
  });

  it('fails closed for unknown providers', async () => {
    const router = new ProviderAvailabilityExtractor({ google: fake(), calendly: fake(), calcom: fake() });
    await expect(router.extract('https://example.com/event', options)).rejects.toThrow(/allowed public booking provider/i);
  });

  it('closes the browser without starting setup when extraction is already aborted', async () => {
    const close = vi.fn(async () => undefined);
    const newContext = vi.fn();
    const browser = { close, newContext } as any;
    const controller = new AbortController();
    controller.abort();
    const extractor = new CalComAvailabilityExtractor(async () => browser);

    await expect(extractor.extract('https://cal.com/example/30min', { ...options, signal: controller.signal }))
      .rejects.toThrow(/timed out/i);
    expect(newContext).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});
