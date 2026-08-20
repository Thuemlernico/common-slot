import type { BrowserContext } from 'playwright';
import { DateTime } from 'luxon';
import { validatePublicNetworkUrl, validatePublicProviderUrl, type Provider } from '../security/urls.js';

export const PROVIDER_DOCUMENT_HOSTS: Readonly<Record<Exclude<Provider, 'unknown'>, ReadonlySet<string>>> = {
  google: new Set(['calendar.google.com', 'calendar.app.google']),
  calendly: new Set(['calendly.com', 'www.calendly.com']),
  calcom: new Set(['cal.com', 'www.cal.com', 'i.cal.com'])
};

export function parseAppointmentDuration(text: string, fallback: number): number {
  const candidates: Array<{ index: number; value: number }> = [];
  for (const match of text.matchAll(/(?:duration\s*)?(\d{1,3})\s*(?:minutes?|mins?|min|m)\b/gi)) {
    candidates.push({ index: match.index, value: Number(match[1]) });
  }
  for (const match of text.matchAll(/(?:duration\s*)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/gi)) {
    candidates.push({ index: match.index, value: Math.round(Number(match[1]) * 60) });
  }
  const value = candidates.sort((left, right) => left.index - right.index)[0]?.value ?? fallback;
  if (!Number.isInteger(value) || value < 1 || value > 480) throw new Error('Appointment duration is not recognized');
  return value;
}

export function visibleEnglishMonth(text: string, timezone: string): DateTime | null {
  const match = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i);
  if (!match) return null;
  const parsed = DateTime.fromFormat(`${match[1]} ${match[2]}`, 'LLLL yyyy', { zone: timezone, locale: 'en' });
  return parsed.isValid ? parsed.startOf('month') : null;
}

export async function installProviderNavigationGuard(
  context: BrowserContext,
  provider: Exclude<Provider, 'unknown'>
): Promise<() => Error | undefined> {
  let navigationError: Error | undefined;
  const allowedHosts = PROVIDER_DOCUMENT_HOSTS[provider];
  const checkedOrigins = new Map<string, Promise<void>>();
  await context.route('**/*', async (route) => {
    const request = route.request();
    try {
      const isTopLevelDocument = request.resourceType() === 'document' && request.frame().parentFrame() === null;
      if (isTopLevelDocument) {
        const validated = await validatePublicProviderUrl(request.url());
        if (validated.provider !== provider || !allowedHosts.has(validated.url.hostname.toLowerCase())) {
          throw new Error(`Redirected outside exact ${provider} booking hosts`);
        }
      } else {
        const url = new URL(request.url());
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          const key = url.origin;
          let check = checkedOrigins.get(key);
          if (!check) {
            check = validatePublicNetworkUrl(url.href).then(() => undefined);
            checkedOrigins.set(key, check);
          }
          await check;
        }
      }
      await route.continue();
    } catch (error) {
      navigationError = error instanceof Error ? error : new Error('Unsafe provider navigation');
      await route.abort('blockedbyclient');
    }
  });
  await context.routeWebSocket(/.*/, async (socket) => {
    try {
      const url = new URL(socket.url());
      if (url.protocol !== 'wss:') throw new Error('Provider WebSockets must use WSS');
      await validatePublicNetworkUrl(`https://${url.host}${url.pathname}${url.search}`);
      socket.connectToServer();
    } catch (error) {
      navigationError = error instanceof Error ? error : new Error('Unsafe provider WebSocket');
      await socket.close({ code: 1008, reason: 'Unsafe destination' });
    }
  });
  return () => navigationError;
}

export function canonicalPublicBookingUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.href;
}
