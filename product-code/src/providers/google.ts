import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { DateTime } from 'luxon';
import { coalesceIntervals, type Interval } from '../domain/intervals.js';
import { SUPPORTED_GOOGLE_HOSTS, validatePublicProviderUrl } from '../security/urls.js';
import type { AvailabilityExtractor, ExtractedAvailability, ExtractionOptions } from './types.js';

interface RawSlot {
  date: string;
  label: string;
}

function resolveDate(value: string, timezone: string, referenceYear: number, referenceMonth: number): string | null {
  const iso = value.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (iso) return iso;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  const hasExplicitYear = /\b\d{4}\b/.test(cleaned);
  const candidates: Array<[string, string]> = [
    [cleaned, 'cccc, LLLL d, yyyy'], [cleaned, 'cccc, LLL d, yyyy'],
    [cleaned, 'LLLL d, yyyy'], [cleaned, 'LLL d, yyyy']
  ];
  const datedFragment = cleaned.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+[A-Za-z]+\s+\d{1,2}(?:,?\s+\d{4})?/i)?.[0]
    ?? cleaned.match(/[A-Za-z]{3,9}\s+\d{1,2}(?:,?\s+\d{4})?/i)?.[0];
  if (datedFragment) {
    const hasYear = /\d{4}/.test(datedFragment);
    const withoutWeekday = datedFragment.replace(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+/i, '');
    const monthDate = hasYear ? withoutWeekday : `${withoutWeekday}, ${referenceYear}`;
    candidates.push([monthDate, /^[A-Za-z]{4,}/.test(monthDate) ? 'LLLL d, yyyy' : 'LLL d, yyyy']);
    const augmented = hasYear ? datedFragment : `${datedFragment}, ${referenceYear}`;
    candidates.push([augmented, augmented.includes(',') && /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(augmented) ? 'ccc, LLL d, yyyy' : 'LLL d, yyyy']);
    candidates.push([augmented, /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.test(augmented) ? 'cccc, LLLL d, yyyy' : 'LLLL d, yyyy']);
  }
  for (const [candidate, format] of candidates) {
    let parsed = DateTime.fromFormat(candidate.replace(/,(?=\s*\d{4})/, ','), format, { zone: timezone, locale: 'en' });
    if (!parsed.isValid) continue;
    if (!hasExplicitYear && referenceMonth >= 10 && parsed.month <= 3) parsed = parsed.plus({ years: 1 });
    if (!hasExplicitYear && referenceMonth <= 3 && parsed.month >= 10) parsed = parsed.minus({ years: 1 });
    return parsed.toFormat('yyyy-MM-dd');
  }
  return null;
}

function parseDuration(text: string, fallback: number): number {
  const hourMatch = text.match(/(?:duration\s*)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);
  if (hourMatch?.[1]) return Math.round(Number(hourMatch[1]) * 60);
  const minuteMatch = text.match(/(?:duration\s*)?(\d{1,3})\s*(?:minutes?|mins?)/i);
  return minuteMatch?.[1] ? Number(minuteMatch[1]) : fallback;
}

function timesFromLabel(label: string): [string, string?] | null {
  const matches = [...label.matchAll(/\b(\d{1,2}:\d{2})\s*([ap]\.?m\.?)?/gi)];
  if (!matches[0]?.[1]) return null;
  const first = `${matches[0][1]}${matches[0][2] ? ` ${matches[0][2]}` : ''}`;
  if (matches[1]?.[1]) {
    return [first, `${matches[1][1]}${matches[1][2] ? ` ${matches[1][2]}` : ''}`];
  }
  return [first];
}

function parseLocal(date: string, time: string, timezone: string): DateTime {
  const normalized = time.replace(/\./g, '').toUpperCase();
  const format = /[AP]M$/.test(normalized) ? 'yyyy-MM-dd h:mm a' : 'yyyy-MM-dd H:mm';
  const value = DateTime.fromFormat(`${date} ${normalized}`, format, { zone: timezone, locale: 'en' });
  if (!value.isValid) throw new Error(`Could not parse Google slot time: ${date} ${time}`);
  return value;
}

/** Purely reads semantic controls. It never clicks an appointment time. */
export async function parseGooglePage(page: Page, timezone: string, fallbackDurationMinutes: number, referenceYear = DateTime.now().setZone(timezone).year, referenceMonth = DateTime.now().setZone(timezone).month): Promise<{ intervals: Interval[]; appointmentDurationMinutes: number }> {
  const bodyText = await page.locator('body').innerText();
  const appointmentDurationMinutes = parseDuration(bodyText, fallbackDurationMinutes);
  const slots = await page.locator('button:not([disabled]), [role="button"]:not([aria-disabled="true"])').evaluateAll((elements): RawSlot[] => {
    const output: RawSlot[] = [];
    for (const element of elements) {
      const label = element.getAttribute('aria-label') || element.textContent || '';
      if (!/\d{1,2}:\d{2}/.test(label)) continue;
      const container = element.closest('[data-date], time[datetime], section, [role="group"], [role="list"]');
      const explicit = container?.getAttribute('data-date') || container?.querySelector('time[datetime]')?.getAttribute('datetime') || '';
      const surrounding = `${explicit} ${container?.getAttribute('aria-label') || ''} ${container?.textContent || ''} ${label}`;
      output.push({ date: surrounding.trim(), label: label.trim() });
    }
    return output;
  });

  const intervals: Interval[] = [];
  for (const slot of slots) {
    const date = resolveDate(slot.date, timezone, referenceYear, referenceMonth);
    if (!date) continue;
    const times = timesFromLabel(slot.label);
    if (!times) continue;
    const start = parseLocal(date, times[0], timezone);
    const explicitEnd = times[1] ? parseLocal(date, times[1], timezone) : null;
    let end = explicitEnd ?? start.plus({ minutes: appointmentDurationMinutes });
    if (end <= start) end = end.plus({ days: 1 });
    intervals.push({ start: start.toUTC().toMillis(), end: end.toUTC().toMillis() });
  }
  return { intervals: coalesceIntervals(intervals), appointmentDurationMinutes };
}

function withEnglish(url: URL): string {
  const copy = new URL(url.href);
  copy.searchParams.set('hl', 'en');
  return copy.href;
}

export function assertDateRangeCovered(latestVisibleDate: DateTime, requestedEnd: DateTime): void {
  if (latestVisibleDate < requestedEnd.startOf('day')) {
    throw new Error('Google schedule did not expose the complete requested date range');
  }
}

async function installNavigationGuard(context: BrowserContext): Promise<() => Error | undefined> {
  let navigationError: Error | undefined;
  await context.route('**/*', async (route) => {
    const request = route.request();
    if (request.resourceType() !== 'document') return route.continue();
    try {
      const validated = await validatePublicProviderUrl(request.url());
      if (validated.provider !== 'google' || !SUPPORTED_GOOGLE_HOSTS.has(validated.url.hostname)) {
        throw new Error('Redirected outside exact Google Calendar hosts');
      }
      await route.continue();
    } catch (error) {
      navigationError = error instanceof Error ? error : new Error('Unsafe navigation');
      await route.abort('blockedbyclient');
    }
  });
  return () => navigationError;
}

export class GoogleAppointmentExtractor implements AvailabilityExtractor {
  constructor(private readonly browserFactory: () => Promise<Browser> = () => chromium.launch({ headless: true })) {}

  async extract(input: string, options: ExtractionOptions): Promise<ExtractedAvailability> {
    const initial = await validatePublicProviderUrl(input);
    if (initial.provider !== 'google') throw new Error('Only Google Appointment Schedule extraction is supported');
    if (!DateTime.local().setZone(options.timezone).isValid) throw new Error('Invalid IANA timezone');

    const browser = await this.browserFactory();
    const context = await browser.newContext({ locale: 'en-US', timezoneId: options.timezone });
    const navigationFailure = await installNavigationGuard(context);
    const page = await context.newPage();
    const abort = () => void context.close();
    options.signal?.addEventListener('abort', abort, { once: true });
    try {
      const response = await page.goto(withEnglish(initial.url), { waitUntil: 'domcontentloaded', timeout: 20_000 });
      if (initial.url.hostname === 'calendar.app.google') {
        // Google short links may render a tiny redirect document first. DOMContentLoaded
        // can fire before that document hands off to the canonical schedule.
        await page.waitForURL((candidate) => candidate.hostname === 'calendar.google.com', { timeout: 10_000 });
        await page.waitForLoadState('domcontentloaded');
      }
      if (navigationFailure()) throw navigationFailure();
      if (!response?.ok()) throw new Error(`Google schedule returned HTTP ${response?.status() ?? 'unknown'}`);
      const final = await validatePublicProviderUrl(page.url());
      if (final.provider !== 'google' || final.url.hostname !== 'calendar.google.com') {
        throw new Error('Short link did not resolve to calendar.google.com');
      }
      if (!final.url.pathname.includes('/calendar/appointments/')) throw new Error('URL is not a Google Appointment Schedule');

      const dateLists = page.locator('[role="list"][aria-label]');
      await dateLists.first().waitFor({ state: 'attached', timeout: 5_000 }).catch(() => undefined);
      if (await dateLists.count() === 0) throw new Error('Google schedule markup is not recognized');
      await page.waitForTimeout(150);
      const start = DateTime.fromISO(options.startDate, { zone: options.timezone }).startOf('day');
      const end = DateTime.fromISO(options.endDate, { zone: options.timezone }).endOf('day');
      const now = DateTime.now().setZone(options.timezone);
      const firstLabel = await dateLists.first().getAttribute('aria-label') || '';
      const firstDateIso = resolveDate(firstLabel, options.timezone, now.year, now.month);
      if (!firstDateIso) throw new Error('Google schedule date controls are not recognized');
      const firstVisibleDate = DateTime.fromISO(firstDateIso, { zone: options.timezone }).startOf('day');
      if (end < firstVisibleDate) throw new Error('Requested dates are no longer available on the provider page');
      const pagesToEnd = Math.ceil(Math.max(0, end.diff(firstVisibleDate, 'days').days) / 7) + 1;
      if (pagesToEnd > 9) throw new Error('Requested dates are more than eight weeks from the provider page');
      const maxPages = pagesToEnd;
      const intervals: Interval[] = [];
      let duration = 30;
      let latestVisibleDate = firstVisibleDate;
      const seenPageSignatures = new Set<string>();

      for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
        const parsed = await parseGooglePage(page, options.timezone, duration, firstVisibleDate.year, firstVisibleDate.month);
        duration = parsed.appointmentDurationMinutes;
        const visibleDateLabels = await page.locator('[role="list"][aria-label]').evaluateAll((elements) => elements
          .map((element) => element.getAttribute('aria-label') || '')
          .filter(Boolean));
        const visibleDates = visibleDateLabels.join('|');
        for (const label of visibleDateLabels) {
          const dateIso = resolveDate(label, options.timezone, firstVisibleDate.year, firstVisibleDate.month);
          if (!dateIso) continue;
          const date = DateTime.fromISO(dateIso, { zone: options.timezone }).startOf('day');
          if (date > latestVisibleDate) latestVisibleDate = date;
        }
        const signature = visibleDates || parsed.intervals.map(({ start: value }) => value).join(',');
        if (signature && seenPageSignatures.has(signature)) break;
        if (signature) seenPageSignatures.add(signature);
        intervals.push(...parsed.intervals.filter((interval) => interval.end >= start.toMillis() && interval.start <= end.toMillis()));
        const next = page.getByRole('button', { name: /next(?: day| week| dates?)?/i }).last();
        if (pageIndex === maxPages - 1 || await next.count() === 0 || await next.isDisabled()) break;
        await next.click(); // The only click permitted: calendar pagination, never an appointment slot.
        if (visibleDates) {
          await page.waitForFunction((previousDates) => Array.from(document.querySelectorAll('[role="list"][aria-label]'))
            .map((element) => element.getAttribute('aria-label') || '')
            .filter(Boolean)
            .join('|') !== previousDates, visibleDates, { timeout: 5_000 }).catch(() => undefined);
        }
        await page.waitForTimeout(100);
      }
      assertDateRangeCovered(latestVisibleDate, end);
      return { intervals: coalesceIntervals(intervals), appointmentDurationMinutes: duration, canonicalUrl: final.url.href };
    } catch (error) {
      if (options.signal?.aborted) throw new Error('Google extraction timed out');
      throw error;
    } finally {
      options.signal?.removeEventListener('abort', abort);
      await context.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }
  }
}
