import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import type { AvailabilityExtractor } from '../../src/providers/types.js';

const a = 'https://calendar.google.com/calendar/appointments/schedules/example-a';
const b = 'https://calendar.google.com/calendar/appointments/schedules/example-b';
const base = { links: [a, b], startDate: '2026-08-20', endDate: '2026-08-27', timezone: 'UTC', durationMinutes: 60 };
const ms = (iso: string) => new Date(iso).getTime();

describe('POST /api/compare', () => {
  it('returns a complete duration-aware intersection when every source loads', async () => {
    const extractor: AvailabilityExtractor = {
      extract: vi.fn(async (url) => ({
        canonicalUrl: url,
        appointmentDurationMinutes: url === a ? 60 : 30,
        intervals: url === a
          ? [{ start: ms('2026-08-20T12:00:00Z'), end: ms('2026-08-20T13:00:00Z') }]
          : [
              { start: ms('2026-08-20T12:00:00Z'), end: ms('2026-08-20T12:30:00Z') },
              { start: ms('2026-08-20T12:30:00Z'), end: ms('2026-08-20T13:00:00Z') }
            ]
      }))
    };
    const response = await request(createApp({ extractor })).post('/api/compare').send(base).expect(200);
    expect(response.body.complete).toBe(true);
    expect(response.body.sources).toHaveLength(2);
    expect(response.body.sources.every((source: { status: string }) => source.status === 'loaded')).toBe(true);
    expect(response.body.commonSlots).toEqual([{
      start: '2026-08-20T12:00:00.000Z',
      end: '2026-08-20T13:00:00.000Z'
    }]);
  });

  it('loads and intersects mixed Google, Calendly, and Cal.com sources', async () => {
    const extractor: AvailabilityExtractor = {
      extract: vi.fn(async (url) => ({
        canonicalUrl: url,
        appointmentDurationMinutes: 30,
        intervals: [{ start: ms('2026-08-20T12:00:00Z'), end: ms('2026-08-20T13:00:00Z') }]
      }))
    };
    const response = await request(createApp({ extractor })).post('/api/compare').send({
      ...base,
      links: [a, 'https://calendly.com/example/schedule', 'https://cal.com/example/schedule']
    }).expect(200);
    expect(response.body.complete).toBe(true);
    expect(response.body.commonSlots).toEqual([{
      start: '2026-08-20T12:00:00.000Z', end: '2026-08-20T13:00:00.000Z'
    }]);
    expect(response.body.sources.map((source: { provider: string; status: string }) => [source.provider, source.status])).toEqual([
      ['Google Appointment Schedule', 'loaded'], ['Calendly', 'loaded'], ['Cal.com', 'loaded']
    ]);
    expect(extractor.extract).toHaveBeenCalledTimes(3);
  });

  it.each([
    'http://calendly.com/example/schedule',
    'http://cal.com/example/schedule'
  ])('rejects unsafe schemes before extracting that source: %s', async (unsafeUrl) => {
    const extractor: AvailabilityExtractor = { extract: vi.fn() };
    const response = await request(createApp({ extractor })).post('/api/compare').send({
      ...base, links: [unsafeUrl, 'https://calendly.com/example/safe']
    }).expect(200);
    expect(response.body.complete).toBe(false);
    expect(response.body.sources[0]).toMatchObject({ status: 'failed' });
    expect(response.body.sources[0].message).toContain('HTTPS');
    expect(extractor.extract).toHaveBeenCalledTimes(1);
    expect(extractor.extract).not.toHaveBeenCalledWith(unsafeUrl, expect.anything());
  });

  it('rejects private targets before extraction', async () => {
    const extractor: AvailabilityExtractor = { extract: vi.fn() };
    const response = await request(createApp({ extractor })).post('/api/compare').send({
      ...base, links: [a, 'http://127.0.0.1:3000/private']
    }).expect(200);
    expect(response.body.complete).toBe(false);
    expect(response.body.sources[1].status).toBe('failed');
    expect(extractor.extract).toHaveBeenCalledTimes(1);
  });

  it('rejects two links that resolve to the same canonical schedule', async () => {
    const extractor: AvailabilityExtractor = {
      extract: vi.fn(async () => ({
        canonicalUrl: a,
        appointmentDurationMinutes: 30,
        intervals: [{ start: ms('2026-08-20T12:00:00Z'), end: ms('2026-08-20T13:00:00Z') }]
      }))
    };
    const response = await request(createApp({ extractor })).post('/api/compare').send({
      ...base, links: [a, `${a}?utm_source=duplicate`]
    }).expect(200);
    expect(response.body.complete).toBe(false);
    expect(response.body.commonSlots).toEqual([]);
    expect(response.body.sources[1]).toMatchObject({ status: 'failed', message: expect.stringContaining('duplicates') });
  });

  it.each([
    ['https://cal.com/example/30min', 'https://i.cal.com/example/30min?utm_source=duplicate', 'Cal.com'],
    ['https://cal.com/example/30min', 'https://www.cal.com/example/30min', 'Cal.com'],
    ['https://calendly.com/example/30min', 'https://www.calendly.com/example/30min?month=2026-08', 'Calendly']
  ])('normalizes provider hosts and query parameters for duplicate identity: %s', async (first, second, label) => {
    const extractor: AvailabilityExtractor = {
      extract: vi.fn(async (url) => ({
        canonicalUrl: url,
        appointmentDurationMinutes: 30,
        intervals: [{ start: ms('2026-08-20T12:00:00Z'), end: ms('2026-08-20T13:00:00Z') }]
      }))
    };
    const response = await request(createApp({ extractor })).post('/api/compare').send({
      ...base, links: [first, second]
    }).expect(200);
    expect(response.body.complete).toBe(false);
    expect(response.body.commonSlots).toEqual([]);
    expect(response.body.sources[1]).toMatchObject({ provider: label, status: 'failed', message: expect.stringContaining('duplicates') });
  });

  it('validates bounded requests and calendar semantics', async () => {
    const extractor: AvailabilityExtractor = { extract: vi.fn() };
    await request(createApp({ extractor })).post('/api/compare').send({ ...base, links: [a] }).expect(400);
    const timezoneResponse = await request(createApp({ extractor })).post('/api/compare').send({ ...base, timezone: 'Mars/Olympus' }).expect(400);
    const timezoneMessages = timezoneResponse.body.issues.map((issue: { message: string }) => issue.message);
    expect(timezoneMessages).toContain('Use a valid IANA timezone');
    expect(timezoneMessages).not.toContain('End date must be on or after start date');
    await request(createApp({ extractor })).post('/api/compare').send({ ...base, endDate: '2027-08-20' }).expect(400);
  });

  it('sets baseline browser security headers', async () => {
    const response = await request(createApp({ extractor: { extract: vi.fn() } })).get('/').expect(200);
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
  });
});
