import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { parseCalComPage } from '../../src/providers/calcom.js';

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
afterAll(async () => { await browser.close(); });

describe('Cal.com fixture parser', () => {
  it('reads UTC data-time controls and duration without clicking appointment controls', async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Extended Meeting</h1><div><svg data-testid="clock-icon"></svg><span>1.5 hours</span></div>
        <button data-testid="day" data-disabled="false">22</button>
        <button class="slot" data-testid="time" data-time="2026-08-22T15:30:00.000Z">17:30</button>
        <button class="slot" data-testid="time" data-time="2026-08-22T17:30:00.000Z">19:30</button>
      </main>`);
    await page.locator('body').evaluate((body) => {
      body.dataset.timeClicks = '0';
      for (const button of body.querySelectorAll('button.slot')) {
        button.addEventListener('click', () => { body.dataset.timeClicks = String(Number(body.dataset.timeClicks ?? '0') + 1); });
      }
    });
    const parsed = await parseCalComPage(page, 60);
    expect(parsed.appointmentDurationMinutes).toBe(90);
    expect(parsed.intervals).toEqual([
      { start: new Date('2026-08-22T15:30:00Z').getTime(), end: new Date('2026-08-22T17:00:00Z').getTime() },
      { start: new Date('2026-08-22T17:30:00Z').getTime(), end: new Date('2026-08-22T19:00:00Z').getTime() }
    ]);
    expect(await page.locator('body').getAttribute('data-time-clicks')).toBe('0');
    await page.close();
  });

  it('fails closed on malformed enabled time controls', async () => {
    const page = await browser.newPage();
    await page.setContent('<div><svg data-testid="clock-icon"></svg>30Min</div><button data-testid="time" data-time="tomorrow">17:30</button>');
    await expect(parseCalComPage(page, 30)).rejects.toThrow(/time controls/i);
    await page.close();
  });

  it('fails closed when time controls belong to a different selected day', async () => {
    const page = await browser.newPage();
    await page.setContent('<div><svg data-testid="clock-icon"></svg>30Min</div><button data-testid="time" data-time="2026-08-22T15:30:00.000Z">17:30</button>');
    await expect(parseCalComPage(page, 30, '2026-08-23', 'Europe/Berlin')).rejects.toThrow(/stale time controls/i);
    await page.close();
  });

  it('returns a valid duration when no time controls are available', async () => {
    const page = await browser.newPage();
    await page.setContent('<main><div><svg data-testid="clock-icon"></svg>30Min</div><p>Cancellation allowed up to 24 hours before.</p></main>');
    await expect(parseCalComPage(page, Number.NaN)).resolves.toEqual({ intervals: [], appointmentDurationMinutes: 30 });
    await page.close();
  });
});
