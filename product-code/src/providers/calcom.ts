import { type Browser, type BrowserContext, type Page } from 'playwright';
import { DateTime } from 'luxon';
import { coalesceIntervals, type Interval } from '../domain/intervals.js';
import { validatePublicProviderUrl } from '../security/urls.js';
import {
  canonicalPublicBookingUrl,
  installProviderNavigationGuard,
  parseAppointmentDuration
} from './browser-utils.js';
import type { AvailabilityExtractor, ExtractedAvailability, ExtractionOptions } from './types.js';
import { launchPinnedBrowser } from './pinned-browser.js';

async function calComDuration(page: Page, fallback: number): Promise<number> {
  const details = await page.locator('[data-testid="clock-icon"]').locator('..').allInnerTexts();
  for (const detail of details) {
    try { return parseAppointmentDuration(detail, Number.NaN); } catch { /* inspect the next semantic clock detail */ }
  }
  return parseAppointmentDuration('', fallback);
}

/** Reads Cal.com UTC data-time controls. It never clicks an appointment-time control. */
export async function parseCalComPage(
  page: Page,
  fallbackDurationMinutes: number,
  expectedLocalDate?: string,
  timezone = 'UTC'
): Promise<{ intervals: Interval[]; appointmentDurationMinutes: number }> {
  const appointmentDurationMinutes = await calComDuration(page, fallbackDurationMinutes);
  const values = await page.locator('button[data-testid="time"]:not([disabled]):not([aria-disabled="true"])')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-time') || ''));
  const intervals: Interval[] = [];
  for (const value of values) {
    const start = DateTime.fromISO(value, { setZone: true });
    if (!value || !start.isValid || !/Z$|[+-]\d{2}:?\d{2}$/.test(value)) {
      throw new Error('Cal.com time controls are not recognized');
    }
    if (expectedLocalDate && start.setZone(timezone).toISODate() !== expectedLocalDate) {
      throw new Error('Cal.com returned stale time controls for another day');
    }
    intervals.push({
      start: start.toUTC().toMillis(),
      end: start.plus({ minutes: appointmentDurationMinutes }).toUTC().toMillis()
    });
  }
  return { intervals: coalesceIntervals(intervals), appointmentDurationMinutes };
}

export class CalComAvailabilityExtractor implements AvailabilityExtractor {
  constructor(private readonly browserFactory: () => Promise<Browser> = launchPinnedBrowser) {}

  async extract(input: string, options: ExtractionOptions): Promise<ExtractedAvailability> {
    const initial = await validatePublicProviderUrl(input);
    if (initial.provider !== 'calcom') throw new Error('Only Cal.com extraction is supported by this adapter');
    if (!DateTime.local().setZone(options.timezone).isValid) throw new Error('Invalid IANA timezone');

    const browser = await this.browserFactory();
    let context: BrowserContext | undefined;
    let abort: (() => void) | undefined;
    try {
      abort = () => {
        void context?.close();
        void browser.close();
      };
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) {
        abort();
        throw new Error('Cal.com extraction timed out');
      }
      context = await browser.newContext({ locale: 'en-US', timezoneId: options.timezone, serviceWorkers: 'block' });
      const navigationFailure = await installProviderNavigationGuard(context, 'calcom');
      const page = await context.newPage();
      const response = await page.goto(initial.url.href, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      if (navigationFailure()) throw navigationFailure();
      if (!response?.ok()) throw new Error(`Cal.com page returned HTTP ${response?.status() ?? 'unknown'}`);
      const final = await validatePublicProviderUrl(page.url());
      if (final.provider !== 'calcom') throw new Error('Cal.com redirected outside its booking hosts');
      if (final.url.pathname.split('/').filter(Boolean).length < 2) throw new Error('URL is not a Cal.com event page');
      if (/404|not found|does not exist/i.test(`${await page.title()} ${await page.locator('body').innerText()}`)) {
        throw new Error('Cal.com event page was not found');
      }

      const days = page.locator('button[data-testid="day"]');
      await days.first().waitFor({ state: 'attached', timeout: 8_000 }).catch(() => undefined);
      if (await days.count() === 0) throw new Error('Cal.com booking markup is not recognized');

      const start = DateTime.fromISO(options.startDate, { zone: options.timezone }).startOf('day');
      const end = DateTime.fromISO(options.endDate, { zone: options.timezone }).endOf('day');
      const intervals: Interval[] = [];
      let duration = await calComDuration(page, Number.NaN);
      let coveredThrough: DateTime | null = null;

      for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
        const monthLabel = page.locator('[data-testid="selected-month-label"][datetime]').first();
        await monthLabel.waitFor({ state: 'attached', timeout: 5_000 });
        const month = DateTime.fromFormat(await monthLabel.getAttribute('datetime') ?? '', 'yyyy-MM', { zone: options.timezone }).startOf('month');
        if (!month.isValid) throw new Error('Cal.com month controls are not recognized');
        coveredThrough = month.endOf('month');
        if (pageIndex === 0 && end < month.startOf('month')) throw new Error('Requested dates are no longer available on Cal.com');

        const availableDays = page.locator('button[data-testid="day"][data-disabled="false"]:not([disabled]):not([aria-disabled="true"])');
        const count = await availableDays.count();
        for (let index = 0; index < count; index += 1) {
          const day = availableDays.nth(index);
          const dayNumber = Number.parseInt((await day.innerText()).trim(), 10);
          if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) throw new Error('Cal.com day controls are not recognized');
          const expectedDate = month.set({ day: dayNumber }).toISODate();
          if (!expectedDate) throw new Error('Cal.com day controls are not recognized');
          await day.click(); // Date selection only; appointment-time controls are never clicked.
          await page.waitForFunction(({ date, zone }) => {
            const values = Array.from(document.querySelectorAll('button[data-testid="time"][data-time]'))
              .map((element) => element.getAttribute('data-time')).filter((value): value is string => Boolean(value));
            const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
            return values.length > 0 && values.every((value) => {
              const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
              return `${parts.year}-${parts.month}-${parts.day}` === date;
            });
          }, { date: expectedDate, zone: options.timezone }, { timeout: 5_000 });
          await page.locator('button[data-testid="time"][data-time]').first().waitFor({ state: 'attached', timeout: 5_000 });
          const parsed = await parseCalComPage(page, duration, expectedDate, options.timezone);
          if (parsed.intervals.length === 0) throw new Error('Cal.com exposed an available day without recognized time controls');
          duration = parsed.appointmentDurationMinutes;
          intervals.push(...parsed.intervals.filter((interval) => interval.end >= start.toMillis() && interval.start <= end.toMillis()));
        }

        if (coveredThrough >= end) break;
        const next = page.locator('button[data-testid="incrementMonth"]');
        if (await next.count() === 0 || await next.isDisabled()) break;
        const previousMonth = month.toFormat('yyyy-MM');
        await next.click(); // Calendar pagination only.
        await page.waitForFunction((previous) => document.querySelector('[data-testid="selected-month-label"][datetime]')?.getAttribute('datetime') !== previous, previousMonth, { timeout: 5_000 });
      }

      if (!coveredThrough || coveredThrough < end) throw new Error('Cal.com did not expose the complete requested date range');
      if (navigationFailure()) throw navigationFailure();
      return {
        intervals: coalesceIntervals(intervals),
        appointmentDurationMinutes: duration,
        canonicalUrl: canonicalPublicBookingUrl(final.url.href)
      };
    } catch (error) {
      if (options.signal?.aborted) throw new Error('Cal.com extraction timed out');
      throw error;
    } finally {
      if (abort) options.signal?.removeEventListener('abort', abort);
      await context?.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }
  }
}
