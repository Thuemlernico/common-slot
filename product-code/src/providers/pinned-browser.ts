import http from 'node:http';
import net from 'node:net';
import { isIP } from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';
import { chromium, type Browser } from 'playwright';
import { isPublicAddress } from '../security/urls.js';

interface AddressRecord { address: string; family: number }
type AddressLookup = (hostname: string) => Promise<readonly AddressRecord[]>;

export async function selectPinnedPublicAddress(
  hostname: string,
  lookup: AddressLookup = async (value) => dnsLookup(value, { all: true, verbatim: true })
): Promise<AddressRecord> {
  const normalized = hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(normalized)
    ? [{ address: normalized, family: isIP(normalized) }]
    : await lookup(normalized);
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Proxy destination must resolve only to public addresses');
  }
  return [...addresses].sort((left, right) => left.family - right.family)[0]!;
}

/**
 * Launch Chromium behind a loopback CONNECT proxy. The proxy resolves, validates and then
 * connects to the exact chosen public IP, eliminating the validation/connection DNS gap.
 */
export async function launchPinnedBrowser(): Promise<Browser> {
  const sockets = new Set<net.Socket>();
  const proxy = http.createServer((_request, response) => {
    response.writeHead(403, { Connection: 'close' });
    response.end();
  });
  proxy.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  proxy.on('connect', (request, client, head) => {
    void (async () => {
      let upstream: net.Socket | undefined;
      try {
        const authority = new URL(`http://${request.url ?? ''}`);
        const port = Number(authority.port || '80');
        if (port !== 443) throw new Error('Proxy permits CONNECT only to port 443');
        const target = await selectPinnedPublicAddress(authority.hostname);
        upstream = net.connect({ host: target.address, port, family: target.family }, () => {
          client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          if (head.length > 0) upstream?.write(head);
          upstream?.pipe(client);
          client.pipe(upstream!);
        });
        upstream.once('error', () => client.destroy());
        client.once('error', () => upstream?.destroy());
      } catch {
        client.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        client.destroy();
        upstream?.destroy();
      }
    })();
  });

  await new Promise<void>((resolve, reject) => {
    proxy.once('error', reject);
    proxy.listen(0, '127.0.0.1', () => {
      proxy.off('error', reject);
      resolve();
    });
  });
  const address = proxy.address();
  if (!address || typeof address === 'string') throw new Error('Could not start the pinned browser proxy');

  const closeProxy = async () => {
    for (const socket of sockets) socket.destroy();
    if (!proxy.listening) return;
    await new Promise<void>((resolve) => proxy.close(() => resolve()));
  };

  let browser: Browser;
  try {
    browser = await chromium.launch({
      headless: true,
      timeout: 15_000,
      args: ['--proxy-bypass-list=<-loopback>'],
      proxy: { server: `http://127.0.0.1:${address.port}` }
    });
  } catch (error) {
    await closeProxy();
    throw error;
  }

  const originalClose = browser.close.bind(browser);
  let closed = false;
  return new Proxy(browser, {
    get(target, property) {
      if (property === 'close') {
        return async () => {
          if (closed) return;
          closed = true;
          try { await originalClose(); } finally { await closeProxy(); }
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}
