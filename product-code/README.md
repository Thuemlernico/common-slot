# Common Slot MVP (PBI-0001)

Common Slot is a Node 22 + TypeScript web application that compares 2–10 public scheduling links and shows only continuous availability shared by every loaded source. It does not reserve or book appointments and stores no links or availability.

## Provider support

| Provider | Status | Notes |
|---|---|---|
| Google Appointment Schedule (`calendar.google.com`) | Supported | Browser extraction; English UI forced with `hl=en`; browser timezone matches the request. |
| Google short link (`calendar.app.google`) | Supported | Every document navigation is revalidated and must finish on the exact canonical Google Calendar host. |
| Calendly | Detected, unsupported | Explicit status; no partial result is shown. |
| Cal.com | Detected, unsupported | Explicit status; no partial result is shown. |

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

Limits: 2–10 unique links, 2,048 characters per link, valid IANA timezone, 5–480 minute duration, at most 31 days per comparison, and a requested Google horizon no more than eight weeks beyond the first provider-visible date. A response has a status for every source. `complete` is false and `commonSlots` is empty if any source is failed or unsupported. Times are ISO-8601 UTC instants; `timezone` records the requested display/interpretation zone.

`GET /api/health` returns process health.

## Live Google verification

Use only public test schedules you are authorized to access. The command does not print or persist links, click a slot, or submit a booking:

```bash
TZ_NAME=Europe/Berlin DURATION_MINUTES=30 \
  npm run --silent smoke:live -- '<google-link-1>' '<google-link-2>'
```

The extractor reads semantic time controls, coalesces touching source slots, paginates only through a button accessible as “Next day/week/dates,” and closes the isolated browser context after each source. It never clicks any time-slot control.

## Security and privacy

- HTTPS only; credentials, direct IP targets, non-standard ports, deceptive subdomains, and non-allowlisted hosts are rejected before extraction.
- Exact provider hosts are DNS-checked; private, loopback, link-local, documentation, multicast, and reserved resolutions are blocked.
- Each top-level browser navigation and redirect is checked again. A Google short link must end on exact `calendar.google.com` and an appointment-schedule path.
- Request body (32 KiB), links, range, extraction timeout (25 seconds/source), pagination (maximum nine rendered pages / eight weeks), and per-request browser work are bounded.
- Restrictive CSP, clickjacking, MIME sniffing, referrer, browser-capability, and no-store response controls are enabled.
- Submitted links are never included in server logs. There is no database, analytics, cookie, or persistent cache.
- Fixture URLs and people are synthetic.

## Architecture

- `src/domain/intervals.ts`: half-open UTC intervals, touching-slot coalescing, N-way duration-aware intersection.
- `src/security/urls.ts`: exact host classification, URL policy, DNS/IP SSRF checks.
- `src/providers/google.ts`: Playwright extraction and safe navigation.
- `src/api/`: Zod request contract and comparison orchestration.
- `src/app.ts`: Express API, static UI, and security headers.
- `tests/unit`: interval and URL-security invariants.
- `tests/integration`: API behavior and Google DOM fixtures using real Chromium.
- `tests/e2e`: responsive desktop/mobile user journey.

## Known limitations

- No atomic multi-provider reservation is possible; users must reconfirm and book separately on original pages.
- Google markup and accessible labels are not a stable public API. Static fixtures cover known semantic forms, but live smoke testing is necessary after provider changes.
- The extractor supports English month/time labels, 12/24-hour times, and explicit or inferred slot ends. A substantially different Google experiment may fail closed.
- Calendly and Cal.com are intentionally unsupported pending a lawful, stable, tested adapter.
- The application is single-process and stateless. For Internet exposure, place it behind an authenticated reverse proxy with global rate limiting and resource quotas.
