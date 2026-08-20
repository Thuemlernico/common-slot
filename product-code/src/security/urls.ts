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
  'www.cal.com': 'calcom',
  'i.cal.com': 'calcom'
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

function ipv6Words(address: string): number[] | null {
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const parseHalf = (half: string): number[] => half ? half.split(':').map((word) => Number.parseInt(word, 16)) : [];
  const left = parseHalf(halves[0] ?? '');
  const right = parseHalf(halves[1] ?? '');
  const missing = halves.length === 2 ? 8 - left.length - right.length : 0;
  const words = [...left, ...Array.from({ length: Math.max(0, missing) }, () => 0), ...right];
  return words.length === 8 && words.every((word) => Number.isInteger(word) && word >= 0 && word <= 0xffff) ? words : null;
}

function embeddedV4(words: number[], offset: number): string {
  const high = words[offset] ?? 0;
  const low = words[offset + 1] ?? 0;
  return `${high >>> 8}.${high & 0xff}.${low >>> 8}.${low & 0xff}`;
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

    const words = ipv6Words(normalized);
    if (!words) return false;
    // Deprecated site-local, discard-only, Teredo, benchmarking and ORCHID ranges are not public destinations.
    if ((words[0]! & 0xffc0) === 0xfec0) return false;
    if (words[0] === 0x0100 && words.slice(1).every((word) => word === 0)) return false;
    if (words[0] === 0x2001 && words[1] === 0x0000) return false;
    if (words[0] === 0x2001 && words[1] === 0x0002 && words[2] === 0x0000) return false;
    if (words[0] === 0x2001 && (words[1]! & 0xfff0) === 0x0010) return false;
    if (words[0] === 0x2001 && (words[1]! & 0xfff0) === 0x0020) return false;

    // IPv4-compatible/mapped, NAT64 and 6to4 addresses inherit the embedded IPv4 policy.
    const compatible = words.slice(0, 5).every((word) => word === 0) && (words[5] === 0 || words[5] === 0xffff);
    if (compatible) return isPublicAddress(embeddedV4(words, 6));
    const nat64 = words[0] === 0x0064 && words[1] === 0xff9b && words.slice(2, 6).every((word) => word === 0);
    if (nat64) return isPublicAddress(embeddedV4(words, 6));
    if (words[0] === 0x0064 && words[1] === 0xff9b && words[2] === 0x0001) return false;
    if (words[0] === 0x2002) return isPublicAddress(embeddedV4(words, 1));
    if (words[0] === 0x3fff && (words[1]! & 0xf000) === 0) return false;
    // Native public IPv6 destinations are currently allocated from 2000::/3.
    return (words[0]! & 0xe000) === 0x2000;
  }
  return false;
}

export interface ValidatedProviderUrl {
  url: URL;
  provider: Provider;
}

/** Validate an arbitrary browser network destination before loading a provider-owned subresource. */
export async function validatePublicNetworkUrl(input: string, lookup: Lookup = defaultLookup): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Invalid network URL');
  }
  if (url.protocol !== 'https:') throw new Error('Provider resources must use HTTPS');
  if (url.username || url.password) throw new Error('Credentials in provider resources are not allowed');
  if (url.port && url.port !== '443') throw new Error('Non-standard resource ports are not allowed');

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) {
    if (!isPublicAddress(hostname)) throw new Error('Resource host must resolve only to public addresses');
    return url;
  }
  const addresses = await lookup(hostname);
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Resource host must resolve only to public addresses');
  }
  return url;
}

/** Validate exact provider identity and DNS before any provider network request. */
export async function validatePublicProviderUrl(input: string, lookup: Lookup = defaultLookup): Promise<ValidatedProviderUrl> {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('Invalid booking URL'); }
  if (url.protocol !== 'https:') throw new Error('Booking links must use HTTPS');
  if (url.username || url.password) throw new Error('Credentials in booking URLs are not allowed');
  if (url.port && url.port !== '443') throw new Error('Non-standard ports are not allowed');
  if (isIP(url.hostname.replace(/^\[|\]$/g, ''))) throw new Error('IP address targets are not allowed');

  const provider = classifyBookingUrl(url.href);
  if (provider === 'unknown') throw new Error('Booking provider host is not allowed');
  await validatePublicNetworkUrl(url.href, lookup);
  return { url, provider };
}

export const SUPPORTED_GOOGLE_HOSTS = new Set(['calendar.google.com', 'calendar.app.google']);
