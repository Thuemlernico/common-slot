import { describe, expect, it, vi } from 'vitest';
import { classifyBookingUrl, validatePublicProviderUrl } from '../../src/security/urls.js';

const publicLookup = vi.fn(async () => [{ address: '142.250.74.14', family: 4 }] as const);

describe('booking URL security', () => {
  it.each([
    'http://calendar.google.com/calendar/appointments/schedules/demo',
    'https://127.0.0.1:3000/x',
    'https://user:pass@calendar.google.com/x',
    'https://calendar.google.com:444/x',
    'https://calendar.google.com.evil.example/x'
  ])('rejects unsafe URL %s before navigation', async (url) => {
    await expect(validatePublicProviderUrl(url, publicLookup)).rejects.toThrow();
  });

  it('classifies exact supported and explicitly unsupported hosts', () => {
    expect(classifyBookingUrl('https://calendar.google.com/calendar/appointments/schedules/demo')).toBe('google');
    expect(classifyBookingUrl('https://calendar.app.google/abc')).toBe('google');
    expect(classifyBookingUrl('https://calendly.com/example/demo')).toBe('calendly');
    expect(classifyBookingUrl('https://cal.com/example/demo')).toBe('calcom');
    expect(classifyBookingUrl('https://notcal.com/demo')).toBe('unknown');
  });

  it.each(['10.0.0.1', '127.0.0.1', '169.254.1.1', '192.168.1.2', '::1', 'fc00::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '0:0:0:0:0:ffff:7f00:1', '::7f00:1'])('rejects private resolution %s', async (address) => {
    const lookup = vi.fn(async () => [{ address, family: address.includes(':') ? 6 : 4 }]);
    await expect(validatePublicProviderUrl('https://calendar.google.com/x', lookup)).rejects.toThrow(/public/i);
  });

  it('accepts a public exact provider host', async () => {
    await expect(validatePublicProviderUrl('https://calendar.google.com/calendar/appointments/schedules/demo', publicLookup))
      .resolves.toMatchObject({ provider: 'google', url: expect.any(URL) });
  });
});
