import { intersectAvailability } from '../domain/intervals.js';
import { classifyBookingUrl, validatePublicProviderUrl, type Provider } from '../security/urls.js';
import type { AvailabilityExtractor } from '../providers/types.js';
import type { CompareRequest } from './schema.js';

export type SourceStatus = 'loaded' | 'unsupported' | 'failed';
export interface SourceResult {
  provider: string;
  status: SourceStatus;
  bookingUrl: string;
  appointmentDurationMinutes?: number;
  message?: string;
}
export interface CompareResponse {
  complete: boolean;
  comparedAt: string;
  timezone: string;
  durationMinutes: number;
  sources: SourceResult[];
  commonSlots: Array<{ start: string; end: string }>;
  warning: string;
}

const providerLabel = (provider: Provider): string => ({ google: 'Google Appointment Schedule', calendly: 'Calendly', calcom: 'Cal.com', unknown: 'Unknown' })[provider];
const scheduleIdentity = (provider: Provider, value: string): string => {
  const url = new URL(value);
  if (provider === 'google') {
    const scheduleId = url.pathname.match(/\/schedules\/([^/]+)/)?.[1];
    if (scheduleId) return `google:${scheduleId}`;
  }
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  const host = provider === 'calcom' && ['i.cal.com', 'www.cal.com'].includes(url.hostname)
    ? 'cal.com'
    : provider === 'calendly' && url.hostname === 'www.calendly.com'
      ? 'calendly.com'
      : url.hostname;
  return `${provider}:${host}${url.pathname}`;
};
const safeMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : 'Availability could not be read';
  return message.replace(/https?:\/\/\S+/g, '[link]').slice(0, 240);
};

export async function withTimeout<T>(milliseconds: number, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const operationPromise = Promise.resolve().then(() => operation(controller.signal));
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(new Error('Availability extraction timed out'));
      controller.abort();
    }, milliseconds);
  });
  try {
    return await Promise.race([operationPromise, timeout]);
  } catch (error) {
    if (timedOut) {
      await Promise.race([
        operationPromise.then(() => undefined, () => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, 250))
      ]);
      throw new Error('Availability extraction timed out');
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function compareAvailability(input: CompareRequest, extractor: AvailabilityExtractor): Promise<CompareResponse> {
  const extractedIntervals: Array<import('../domain/intervals.js').Interval[] | null> = [];
  const sources: SourceResult[] = [];
  const seenSchedules = new Set<string>();

  // Sequential extraction intentionally caps expensive browser concurrency per request.
  for (const bookingUrl of input.links) {
    const provider = classifyBookingUrl(bookingUrl);
    try {
      // Apply the same URL and DNS policy to every recognized provider before reporting support status.
      await validatePublicProviderUrl(bookingUrl);
      if (provider === 'unknown') throw new Error('The URL is not an allowed public booking provider.');

      // The extractor repeats validation at the network boundary.
      const result = await withTimeout(25_000, (signal) => extractor.extract(bookingUrl, { ...input, signal }));
      const identity = scheduleIdentity(provider, result.canonicalUrl);
      if (seenSchedules.has(identity)) {
        sources.push({ provider: providerLabel(provider), status: 'failed', bookingUrl, message: 'This schedule duplicates another submitted source.' });
        extractedIntervals.push(null);
        continue;
      }
      seenSchedules.add(identity);
      sources.push({ provider: providerLabel(provider), status: 'loaded', bookingUrl, appointmentDurationMinutes: result.appointmentDurationMinutes });
      extractedIntervals.push(result.intervals);
    } catch (error) {
      sources.push({ provider: providerLabel(provider), status: 'failed', bookingUrl, message: safeMessage(error) });
      extractedIntervals.push(null);
    }
  }

  const complete = sources.every(({ status }) => status === 'loaded');
  const common = complete ? intersectAvailability(extractedIntervals as import('../domain/intervals.js').Interval[][], input.durationMinutes) : [];
  return {
    complete,
    comparedAt: new Date().toISOString(),
    timezone: input.timezone,
    durationMinutes: input.durationMinutes,
    sources,
    commonSlots: common.map(({ start, end }) => ({ start: new Date(start).toISOString(), end: new Date(end).toISOString() })),
    warning: 'Availability can change. Reconfirm on every provider page before booking; Common Slot does not reserve or book appointments.'
  };
}
