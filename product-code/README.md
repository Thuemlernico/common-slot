# Common Slot

Common Slot is a Node 22 + TypeScript web application that compares 2–10 public scheduling links and shows only continuous availability shared by every loaded source. It does not reserve or book appointments and stores no links or availability.

## Provider support

| Provider | Status | Notes |
|---|---|---|
| Google Appointment Schedule (`calendar.google.com`) | Supported | Browser extraction; English UI forced with `hl=en`; browser timezone matches the request. |
| Google short link (`calendar.app.google`) | Supported | Every document navigation is revalidated and must finish on the exact canonical Google Calendar host. |
| Calendly | Supported, experimental | Reads semantic available-day and time controls; never clicks a time or submits a booking. |
| Cal.com (`cal.com`, `i.cal.com`) | Supported, experimental | Reads provider-owned UTC `data-time` controls; never clicks a time or submits a booking. |

Provider pages can change without notice. Extraction failure is explicit and suppresses the complete intersection.

## Requirements

- Node.js 22+
- npm
- Chromium installed through Playwright

## Clean-checkout commands

```bash
cd product-code
npm ci
npx playwright install chromium
npm test
npm run build
npm run test:e2e
npm start
```

Open <http://127.0.0.1:3000>. Development mode is `npm run dev`. Set `PORT` and `HOST` to change the listener; the safe default binds only to localhost.

The CI-ready entry point is:

```bash
./ci.sh
```

It performs a lockfile install, installs Playwright Chromium system support, type-checks/builds, runs all Vitest unit/integration tests, and runs desktop/mobile Playwright journeys. A repository-level workflow can invoke `product-code/ci.sh`; workflow placement is intentionally outside this Programmer's allowed `product-code/` write boundary.

## API

`POST /api/compare` with `Content-Type: application/json`:

```json
{
  "links": [
    "https://calendar.google.com/calendar/appointments/schedules/example-a",
    "https://calendar.app.google/example-b"
  ],
  "startDate": "2026-08-20",
  "endDate": "2026-08-27",
  "timezone": "Europe/Berlin",
  "durationMinutes": 30
}
```

Limits: 2–10 unique links, 2,048 characters per link, valid IANA timezone, 5–480 minute duration, at most 31 days per comparison, and at most three rendered calendar months for Calendly/Cal.com (Google keeps its eight-week bound). A response has a status for every source. `complete` is false and `commonSlots` is empty if any source fails. Times are ISO-8601 UTC instants; `timezone` records the requested display/interpretation zone.

`GET /api/health` returns process health.

## Live provider verification

Use only public test schedules you are authorized to access. The command does not print or persist links, click a slot, or submit a booking:

```bash
TZ_NAME=Europe/Berlin DURATION_MINUTES=30 \
  npm run --silent smoke:live -- '<public-link-1>' '<public-link-2>'
```

The provider router reads semantic controls, coalesces touching source slots, closes the isolated browser context after each source, and never clicks any appointment-time control. Only date selection and calendar pagination controls may be clicked.

## Security and privacy

- HTTPS only; credentials, direct IP targets, non-standard ports, deceptive subdomains, and non-allowlisted hosts are rejected before extraction.
- Exact provider hosts are DNS-checked; private, loopback, link-local, documentation, multicast, and reserved resolutions are blocked.
- Every top-level document navigation and redirect is checked again against exact provider hosts. Every HTTP(S) iframe/subresource and WebSocket destination is separately restricted to encrypted transport and public DNS/IP resolutions. A Google short link must end on exact `calendar.google.com` and an appointment-schedule path.
- Calendly/Cal.com Chromium traffic uses a loopback CONNECT proxy that resolves, validates, and connects to the same selected public IP; browser DNS cannot rebind a validated hostname to a private address.
- Request body (32 KiB), links, range, extraction abort deadline (25 seconds/source plus at most 250 ms cleanup grace), pagination (maximum nine rendered pages / eight weeks), and per-request browser work are bounded.
- Restrictive CSP, clickjacking, MIME sniffing, referrer, browser-capability, and no-store response controls are enabled.
- Submitted links are never included in server logs. There is no database, analytics, cookie, or persistent cache.
- Fixture URLs and people are synthetic.

## Architecture

- `src/domain/intervals.ts`: half-open UTC intervals, touching-slot coalescing, N-way duration-aware intersection.
- `src/security/urls.ts`: exact host classification, URL policy, DNS/IP SSRF checks.
- `src/providers/router.ts`: provider dispatch without coupling the interval core to provider markup.
- `src/providers/google.ts`, `calendly.ts`, `calcom.ts`: isolated Playwright extraction.
- `src/providers/pinned-browser.ts`: DNS-pinned public-only CONNECT proxy for provider browser traffic.
- `src/api/`: Zod request contract and comparison orchestration.
- `src/app.ts`: Express API, static UI, and security headers.
- `tests/unit`: interval and URL-security invariants.
- `tests/integration`: API behavior and Google, Calendly, and Cal.com DOM fixtures using real Chromium.
- `tests/e2e`: responsive desktop/mobile user journey.

## Known limitations

- No atomic multi-provider reservation is possible; users must reconfirm and book separately on original pages.
- Provider markup and accessible labels are not stable public APIs. Static fixtures cover known semantic forms, but live smoke testing is necessary after provider changes.
- The adapters use English browser locale, support known 12/24-hour forms, and fail closed on substantially different experiments, authentication challenges, or incomplete ranges.
- Public-page adapters should be replaced by official credentialed APIs when participants authorize their own provider accounts.
- The application is single-process and stateless. For Internet exposure, place it behind an authenticated reverse proxy with global rate limiting and resource quotas.
