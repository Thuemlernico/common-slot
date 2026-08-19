import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { readFile } from 'node:fs/promises';
import { parseGooglePage } from '../../src/providers/google.js';

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
afterAll(async () => { await browser.close(); });

describe('Google Appointment Schedule fixture parser', () => {
  it('reads duration, seven-day date groups, and 12-hour time labels without clicking slots', async () => {
    const page = await browser.newPage();
    const fixture = await readFile(new URL('../fixtures/google-week.html', import.meta.url), 'utf8');
    await page.setContent(fixture);
    const parsed = await parseGooglePage(page, 'Europe/Berlin', 30);
    expect(parsed.appointmentDurationMinutes).toBe(30);
    expect(parsed.intervals).toHaveLength(2);
    expect(parsed.intervals[0]).toEqual({
      start: new Date('2026-08-20T10:00:00.000Z').getTime(),
      end: new Date('2026-08-20T11:00:00.000Z').getTime()
    });
    expect(await page.locator('[aria-label="12:00 PM"]').evaluate((node) => node.matches(':focus'))).toBe(false);
    await page.close();
  });

  it('supports 24-hour labels and explicit end times', async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <p>45 minutes</p><section data-date="2026-11-05">
      <button aria-label="14:15 – 15:00">14:15 – 15:00</button></section>`);
    const parsed = await parseGooglePage(page, 'UTC', 45);
    expect(parsed.intervals).toEqual([{
      start: new Date('2026-11-05T14:15:00Z').getTime(),
      end: new Date('2026-11-05T15:00:00Z').getTime()
    }]);
    await page.close();
  });
});
