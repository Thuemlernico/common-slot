import { describe, expect, it, vi } from 'vitest';
import { classifyBookingUrl, validatePublicNetworkUrl, validatePublicProviderUrl } from '../../src/security/urls.js';

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

  it('classifies exact supported hosts', () => {
    expect(classifyBookingUrl('https://calendar.google.com/calendar/appointments/schedules/demo')).toBe('google');
    expect(classifyBookingUrl('https://calendar.app.google/abc')).toBe('google');
    expect(classifyBookingUrl('https://calendly.com/example/demo')).toBe('calendly');
    expect(classifyBookingUrl('https://cal.com/example/demo')).toBe('calcom');
    expect(classifyBookingUrl('https://i.cal.com/example/demo')).toBe('calcom');
    expect(classifyBookingUrl('https://notcal.com/demo')).toBe('unknown');
  });

  it.each(['10.0.0.1', '127.0.0.1', '169.254.1.1', '192.168.1.2', '::1', 'fc00::1', 'fec0::1', '100::1', '3fff::1', '4000::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '0:0:0:0:0:ffff:7f00:1', '::7f00:1', '64:ff9b::7f00:1', '2002:7f00:1::', '2001::1', '2001:2::1'])('rejects private or non-public resolution %s', async (address) => {
    const lookup = vi.fn(async () => [{ address, family: address.includes(':') ? 6 : 4 }]);
    await expect(validatePublicProviderUrl('https://calendar.google.com/x', lookup)).rejects.toThrow(/public/i);
  });

  it.each(['64:ff9b::808:808', '2002:808:808::'])('accepts transition address with public embedded IPv4 %s', async (address) => {
    const lookup = vi.fn(async () => [{ address, family: 6 }]);
    await expect(validatePublicProviderUrl('https://calendar.google.com/x', lookup)).resolves.toMatchObject({ provider: 'google' });
  });

  it('accepts a public exact provider host', async () => {
    await expect(validatePublicProviderUrl('https://calendar.google.com/calendar/appointments/schedules/demo', publicLookup))
      .resolves.toMatchObject({ provider: 'google', url: expect.any(URL) });
  });

  it('blocks private subresource targets while allowing public CDN hosts', async () => {
    await expect(validatePublicNetworkUrl('https://127.0.0.1/pixel')).rejects.toThrow(/public addresses/i);
    await expect(validatePublicNetworkUrl('https://cdn.example/pixel', publicLookup)).resolves.toMatchObject({ hostname: 'cdn.example' });
  });
});
