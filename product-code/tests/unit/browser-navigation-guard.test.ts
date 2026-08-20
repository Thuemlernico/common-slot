import { describe, expect, it, vi } from 'vitest';
import { installProviderNavigationGuard, parseAppointmentDuration } from '../../src/providers/browser-utils.js';
import { selectPinnedPublicAddress } from '../../src/providers/pinned-browser.js';

describe('provider browser navigation guard', () => {
  it('aborts private-address subresources and records a fail-closed error', async () => {
    let handler: ((route: any) => Promise<void>) | undefined;
    const context = {
      route: vi.fn(async (_pattern, value) => { handler = value; }),
      routeWebSocket: vi.fn(async () => undefined)
    } as any;
    const failure = await installProviderNavigationGuard(context, 'calendly');
    const route = {
      request: () => ({ resourceType: () => 'image', url: () => 'https://127.0.0.1/pixel' }),
      abort: vi.fn(async () => undefined),
      continue: vi.fn(async () => undefined)
    };

    await handler!(route);
    expect(route.abort).toHaveBeenCalledWith('blockedbyclient');
    expect(route.continue).not.toHaveBeenCalled();
    expect(failure()).toBeInstanceOf(Error);
  });

  it('blocks insecure WebSocket destinations before connection', async () => {
    let socketHandler: ((socket: any) => Promise<void>) | undefined;
    const context = {
      route: vi.fn(async () => undefined),
      routeWebSocket: vi.fn(async (_pattern, value) => { socketHandler = value; })
    } as any;
    const failure = await installProviderNavigationGuard(context, 'calcom');
    const socket = {
      url: () => 'ws://127.0.0.1/private',
      connectToServer: vi.fn(),
      close: vi.fn(async () => undefined)
    };
    await socketHandler!(socket);
    expect(socket.connectToServer).not.toHaveBeenCalled();
    expect(socket.close).toHaveBeenCalledWith({ code: 1008, reason: 'Unsafe destination' });
    expect(failure()).toBeInstanceOf(Error);
  });

  it('uses the first semantic duration and rejects missing duration', () => {
    expect(parseAppointmentDuration('30 min meeting. Reschedule up to 24 hours before.', Number.NaN)).toBe(30);
    expect(() => parseAppointmentDuration('Intro call', Number.NaN)).toThrow(/duration/i);
  });

  it('pins a validated public proxy destination and rejects mixed private DNS answers', async () => {
    await expect(selectPinnedPublicAddress('provider.test', async () => [
      { address: '2001:4860:4860::8888', family: 6 },
      { address: '142.250.74.14', family: 4 }
    ])).resolves.toEqual({ address: '142.250.74.14', family: 4 });
    await expect(selectPinnedPublicAddress('provider.test', async () => [
      { address: '142.250.74.14', family: 4 },
      { address: '127.0.0.1', family: 4 }
    ])).rejects.toThrow(/public addresses/i);
  });
});