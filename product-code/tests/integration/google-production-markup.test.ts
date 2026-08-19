import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { DateTime } from 'luxon';
import { assertDateRangeCovered, parseGooglePage } from '../../src/providers/google.js';

let browser: Browser;

beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
afterAll(async () => { await browser.close(); });

describe('Google Appointment Schedule production-shaped semantic markup', () => {
  it('reads a time button from the enclosing role=list date label', async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <div>60 min appointments</div>
        <div role="list" aria-label="Monday, August 24">
          <div role="listitem"><button aria-label="1:00pm">1:00pm</button></div>
          <div role="listitem"><button aria-label="2:00pm">2:00pm</button></div>
        </div>
      </main>
    `);

    const result = await parseGooglePage(page, 'Europe/Berlin', 30, 2026);

    expect(result.appointmentDurationMinutes).toBe(60);
    expect(result.intervals).toEqual([
      {
        start: new Date('2026-08-24T11:00:00.000Z').getTime(),
        end: new Date('2026-08-24T13:00:00.000Z').getTime()
      }
    ]);
    await page.close();
  });

  it('carries yearless January dates into the next year from a December view', async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <body>
        <p>30 min appointments</p>
        <div role="list" aria-label="Saturday, January 2">
          <div role="listitem"><button aria-label="9:00am">9:00am</button></div>
        </div>
      </body>
    `);
    const parsed = await parseGooglePage(page, 'Europe/Berlin', 30, 2026, 12);
    expect(new Date(parsed.intervals[0]!.start).toISOString()).toBe('2027-01-02T08:00:00.000Z');
    await page.close();
  });

  it('fails closed when pagination never reaches the requested end date', () => {
    const latestVisible = DateTime.fromISO('2026-08-24T00:00:00Z');
    const requestedEnd = DateTime.fromISO('2026-08-31T23:59:59Z');
    expect(() => assertDateRangeCovered(latestVisible, requestedEnd)).toThrow(/complete requested date range/);
    expect(() => assertDateRangeCovered(requestedEnd.startOf('day'), requestedEnd)).not.toThrow();
  });
});
