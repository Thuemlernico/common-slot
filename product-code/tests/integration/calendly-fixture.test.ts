import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { parseCalendlyPage } from '../../src/providers/calendly.js';

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
afterAll(async () => { await browser.close(); });

describe('Calendly fixture parser', () => {
  it('reads duration and selected-date times without clicking appointment controls', async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Intro Call</h1><div><div><span data-id="details-item-icon"></span></div> 30 min</div>
        <h3>Friday, August 21</h3>
        <button aria-label="Friday, August 21 - Times available">21</button>
        <ul><li><button class="slot" data-container="time-button">9:00AM</button></li><li><button class="slot" data-container="time-button">10:00 AM</button></li></ul>
        <button>Cookie settings</button><button aria-label="Go to next month"></button>
      </main>`);
    await page.locator('body').evaluate((body) => {
      body.dataset.timeClicks = '0';
      for (const button of body.querySelectorAll('button.slot')) {
        button.addEventListener('click', () => { body.dataset.timeClicks = String(Number(body.dataset.timeClicks ?? '0') + 1); });
      }
    });
    const parsed = await parseCalendlyPage(page, 'Europe/Berlin', 60, 2026, 8);
    expect(parsed.appointmentDurationMinutes).toBe(30);
    expect(parsed.intervals).toEqual([
      { start: new Date('2026-08-21T07:00:00Z').getTime(), end: new Date('2026-08-21T07:30:00Z').getTime() },
      { start: new Date('2026-08-21T08:00:00Z').getTime(), end: new Date('2026-08-21T08:30:00Z').getTime() }
    ]);
    expect(await page.locator('body').getAttribute('data-time-clicks')).toBe('0');
    await page.close();
  });

  it('fails closed when visible time controls have no recognized selected date', async () => {
    const page = await browser.newPage();
    await page.setContent('<main><div><div><span data-id="details-item-icon"></span></div>30 min</div><button data-container="time-button">14:00</button></main>');
    await expect(parseCalendlyPage(page, 'UTC', 30, 2026, 8)).rejects.toThrow(/date controls/i);
    await page.close();
  });

  it('fails closed when any enabled Calendly time control is malformed', async () => {
    const page = await browser.newPage();
    await page.setContent('<main><div><div><span data-id="details-item-icon"></span></div>30 min</div><h3>Friday, August 21</h3><button data-container="time-button">09:00</button><button data-container="time-button">later</button></main>');
    await expect(parseCalendlyPage(page, 'UTC', 30, 2026, 8)).rejects.toThrow(/time controls/i);
    await page.close();
  });

  it('returns a valid duration for a recognized day with no availability', async () => {
    const page = await browser.newPage();
    await page.setContent('<main><div><div><span data-id="details-item-icon"></span></div>30 min</div><p>Cancellation allowed up to 24 hours before.</p></main>');
    await expect(parseCalendlyPage(page, 'UTC', Number.NaN, 2026, 8)).resolves.toEqual({ intervals: [], appointmentDurationMinutes: 30 });
    await page.close();
  });
});
