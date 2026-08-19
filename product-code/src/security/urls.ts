import { isIP } from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';

export type Provider = 'google' | 'calendly' | 'calcom' | 'unknown';
export type Lookup = (hostname: string) => Promise<readonly { address: string; family: number }[]>;

const HOST_PROVIDER: Readonly<Record<string, Provider>> = {
  'calendar.google.com': 'google',
  'calendar.app.google': 'google',
  'calendly.com': 'calendly',
  'www.calendly.com': 'calendly',
  'cal.com': 'calcom',
  'www.cal.com': 'calcom'
};

const defaultLookup: Lookup = async (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

export function classifyBookingUrl(input: string): Provider {
  try {
    return HOST_PROVIDER[new URL(input).hostname.toLowerCase()] ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function ipv4Number(address: string): number {
  return address.split('.').reduce((value, octet) => (value * 256) + Number(octet), 0) >>> 0;
}

function inV4Range(address: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4Number(address) & mask) === (ipv4Number(base) & mask);
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const blocked: Array<[string, number]> = [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
      ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
      ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
      ['224.0.0.0', 4], ['240.0.0.0', 4]
    ];
    return !blocked.some(([base, bits]) => inV4Range(address, base, bits));
  }
  if (family === 6) {
    let normalized = address.toLowerCase();
    try { normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1).toLowerCase(); } catch { /* isIP already validated the input */ }
    if (normalized === '::' || normalized === '::1') return false;
    if (normalized.startsWith('fc') || normalized.startsWith('fd') || /^fe[89ab]/.test(normalized)) return false;
    if (normalized.startsWith('ff') || normalized.startsWith('2001:db8:')) return false;
    const embeddedV4 = normalized.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (embeddedV4?.[1] && embeddedV4[2]) {
      const high = Number.parseInt(embeddedV4[1], 16);
      const low = Number.parseInt(embeddedV4[2], 16);
      return isPublicAddress(`${high >>> 8}.${high & 0xff}.${low >>> 8}.${low & 0xff}`);
    }
    return true;
  }
  return false;
}

export interface ValidatedProviderUrl {
  url: URL;
  provider: Provider;
}

/** Validate exact provider identity and DNS before any provider network request. */
export async function validatePublicProviderUrl(input: string, lookup: Lookup = defaultLookup): Promise<ValidatedProviderUrl> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Invalid booking URL');
  }
  if (url.protocol !== 'https:') throw new Error('Booking links must use HTTPS');
  if (url.username || url.password) throw new Error('Credentials in booking URLs are not allowed');
  if (url.port && url.port !== '443') throw new Error('Non-standard ports are not allowed');
  if (isIP(url.hostname)) throw new Error('IP address targets are not allowed');

  const provider = classifyBookingUrl(url.href);
  if (provider === 'unknown') throw new Error('Booking provider host is not allowed');
  const addresses = await lookup(url.hostname);
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Provider host must resolve only to public addresses');
  }
  return { url, provider };
}

export const SUPPORTED_GOOGLE_HOSTS = new Set(['calendar.google.com', 'calendar.app.google']);
