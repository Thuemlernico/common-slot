import { type Browser, type BrowserContext, type Page } from 'playwright';
import { DateTime } from 'luxon';
import { coalesceIntervals, type Interval } from '../domain/intervals.js';
import { validatePublicProviderUrl } from '../security/urls.js';
import {
  canonicalPublicBookingUrl,
  installProviderNavigationGuard,
  parseAppointmentDuration,
  visibleEnglishMonth
} from './browser-utils.js';
import type { AvailabilityExtractor, ExtractedAvailability, ExtractionOptions } from './types.js';
import { launchPinnedBrowser } from './pinned-browser.js';

const TIME_CONTROL = 'button[data-container="time-button"]:not([disabled]):not([aria-disabled="true"])';

async function calendlyDuration(page: Page, fallback: number): Promise<number> {
  const details = await page.locator('[data-id="details-item-icon"]').locator('xpath=../..').allInnerTexts();
  for (const detail of details) {
    try { return parseAppointmentDuration(detail, Number.NaN); } catch { /* inspect the next semantic detail item */ }
  }
  return parseAppointmentDuration('', fallback);
}

function calendlyDate(label: string, timezone: string, referenceYear: number, referenceMonth: number): DateTime | null {
  const fragment = label.split(/\s+-\s+(?:No times|Times) available/i)[0]?.trim() ?? label.trim();
  const explicitYear = /\b\d{4}\b/.test(fragment);
  const formats = explicitYear
    ? ['cccc, LLLL d, yyyy', 'LLLL d, yyyy']
    : ['cccc, LLLL d', 'LLLL d'];
  for (const format of formats) {
    let parsed = DateTime.fromFormat(fragment, format, { zone: timezone, locale: 'en' });
    if (!parsed.isValid) continue;
    if (!explicitYear) {
      parsed = parsed.set({ year: referenceYear });
      if (referenceMonth >= 10 && parsed.month <= 3) parsed = parsed.plus({ years: 1 });
      if (referenceMonth <= 3 && parsed.month >= 10) parsed = parsed.minus({ years: 1 });
    }
    return parsed.startOf('day');
  }
  return null;
}

function localTime(date: DateTime, text: string): DateTime {
  const normalized = text.replace(/\./g, '').replace(/\s+/g, ' ').trim().toUpperCase().replace(/(\d)([AP]M)$/, '$1 $2');
  const hasMeridiem = /[AP]M$/.test(normalized);
  const format = hasMeridiem ? (normalized.includes(':') ? 'yyyy-MM-dd h:mm a' : 'yyyy-MM-dd h a') : 'yyyy-MM-dd H:mm';
  const parsed = DateTime.fromFormat(`${date.toFormat('yyyy-MM-dd')} ${normalized}`, format, { zone: date.zoneName ?? 'UTC', locale: 'en' });
  if (!parsed.isValid) throw new Error('Calendly time controls are not recognized');
  return parsed;
}

/** Reads a selected Calendly day. It never clicks an appointment-time control. */
export async function parseCalendlyPage(
  page: Page,
  timezone: string,
  fallbackDurationMinutes: number,
  referenceYear: number,
  referenceMonth: number
): Promise<{ intervals: Interval[]; appointmentDurationMinutes: number }> {
  const appointmentDurationMinutes = await calendlyDuration(page, fallbackDurationMinutes);
  const labels = await page.locator(TIME_CONTROL).evaluateAll((elements) => elements
    .map((element) => (element.getAttribute('aria-label') || element.textContent || '').replace(/\s+/g, ' ').trim()));
  if (labels.some((label) => !/^(?:\d{1,2}:\d{2}(?:\s*[ap]m)?|\d{1,2}\s*[ap]m)$/i.test(label))) {
    throw new Error('Calendly time controls are not recognized');
  }
  if (labels.length === 0) return { intervals: [], appointmentDurationMinutes };

  const headings = await page.locator('h2, h3, [role="heading"]').allInnerTexts();
  const selectedDate = headings
    .map((heading) => calendlyDate(heading, timezone, referenceYear, referenceMonth))
    .find((date): date is DateTime => date !== null);
  if (!selectedDate) throw new Error('Calendly date controls are not recognized');

  const intervals = labels.map((label) => {
    const start = localTime(selectedDate, label);
    return { start: start.toUTC().toMillis(), end: start.plus({ minutes: appointmentDurationMinutes }).toUTC().toMillis() };
  });
  return { intervals: coalesceIntervals(intervals), appointmentDurationMinutes };
}

export class CalendlyAvailabilityExtractor implements AvailabilityExtractor {
  constructor(private readonly browserFactory: () => Promise<Browser> = launchPinnedBrowser) {}

  async extract(input: string, options: ExtractionOptions): Promise<ExtractedAvailability> {
    const initial = await validatePublicProviderUrl(input);
    if (initial.provider !== 'calendly') throw new Error('Only Calendly extraction is supported by this adapter');
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
        throw new Error('Calendly extraction timed out');
      }
      context = await browser.newContext({ locale: 'en-US', timezoneId: options.timezone, serviceWorkers: 'block' });
      const navigationFailure = await installProviderNavigationGuard(context, 'calendly');
      const page = await context.newPage();
      const response = await page.goto(initial.url.href, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      if (navigationFailure()) throw navigationFailure();
      if (!response?.ok()) throw new Error(`Calendly page returned HTTP ${response?.status() ?? 'unknown'}`);
      const final = await validatePublicProviderUrl(page.url());
      if (final.provider !== 'calendly') throw new Error('Calendly redirected outside its booking hosts');
      if (final.url.pathname.split('/').filter(Boolean).length < 2) throw new Error('URL is not a Calendly event page');

      const dateButtons = page.locator('button[aria-label*="Times available"]');
      await dateButtons.first().waitFor({ state: 'attached', timeout: 8_000 }).catch(() => undefined);
      if (await dateButtons.count() === 0) throw new Error('Calendly booking markup is not recognized');

      const start = DateTime.fromISO(options.startDate, { zone: options.timezone }).startOf('day');
      const end = DateTime.fromISO(options.endDate, { zone: options.timezone }).endOf('day');
      const intervals: Interval[] = [];
      let duration = await calendlyDuration(page, Number.NaN);
      let coveredThrough: DateTime | null = null;

      for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
        const monthTitle = page.locator('[data-testid="calendar-header"] [data-testid="title"], [data-testid="title"]').filter({ hasText: /\b\d{4}\b/ }).first();
        await monthTitle.waitFor({ state: 'attached', timeout: 5_000 });
        const month = visibleEnglishMonth(await monthTitle.innerText(), options.timezone);
        if (!month) throw new Error('Calendly month controls are not recognized');
        coveredThrough = month.endOf('month');
        if (pageIndex === 0 && end < month.startOf('month')) throw new Error('Requested dates are no longer available on Calendly');

        const availableLabels = await page.locator('button[aria-label*="Times available"]:not([disabled]):not([aria-disabled="true"])')
          .evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label') || '').filter(Boolean));
        for (const label of availableLabels) {
          const date = calendlyDate(label, options.timezone, month.year, month.month);
          if (!date || date < start || date > end) continue;
          const button = page.getByRole('button', { name: label, exact: true });
          await button.evaluate((element) => (element as HTMLButtonElement).click()); // Date selection only; appointment-time controls are never clicked.
          const expectedHeading = label.split(/\s+-\s+/)[0] ?? label;
          await page.waitForFunction((expected) => Array.from(document.querySelectorAll('h2,h3,[role="heading"]'))
            .some((element) => (element.textContent || '').includes(expected)), expectedHeading, { timeout: 5_000 });
          await page.locator(TIME_CONTROL).filter({ hasText: /^\s*\d{1,2}(?::\d{2})?\s*(?:[ap]m)?\s*$/i }).first()
            .waitFor({ state: 'attached', timeout: 5_000 });
          const parsed = await parseCalendlyPage(page, options.timezone, duration, month.year, month.month);
          if (parsed.intervals.length === 0) throw new Error('Calendly exposed an available day without recognized time controls');
          duration = parsed.appointmentDurationMinutes;
          intervals.push(...parsed.intervals.filter((interval) => interval.end >= start.toMillis() && interval.start <= end.toMillis()));
        }

        if (coveredThrough >= end) break;
        const next = page.getByRole('button', { name: /go to next month/i });
        if (await next.count() === 0 || await next.isDisabled()) break;
        const previousMonth = month.toFormat('LLLL yyyy');
        await next.evaluate((element) => (element as HTMLButtonElement).click()); // Calendar pagination only.
        await page.waitForFunction((previous) => Array.from(document.querySelectorAll('[data-testid="calendar-header"] [data-testid="title"], [data-testid="title"]'))
          .some((element) => /\b\d{4}\b/.test(element.textContent || '') && (element.textContent || '').trim() !== previous), previousMonth, { timeout: 5_000 });
      }

      if (!coveredThrough || coveredThrough < end) throw new Error('Calendly did not expose the complete requested date range');
      if (navigationFailure()) throw navigationFailure();
      return {
        intervals: coalesceIntervals(intervals),
        appointmentDurationMinutes: duration,
        canonicalUrl: canonicalPublicBookingUrl(final.url.href)
      };
    } catch (error) {
      if (options.signal?.aborted) throw new Error('Calendly extraction timed out');
      throw error;
    } finally {
      if (abort) options.signal?.removeEventListener('abort', abort);
      await context?.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }
  }
}
