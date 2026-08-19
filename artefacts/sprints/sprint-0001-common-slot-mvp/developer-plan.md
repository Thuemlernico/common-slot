---
type: Developer Plan
title: Common Slot MVP developer plan
description: Technical and quality plan for the first working Increment.
status: stable
created: "2026-08-19"
updated: "2026-08-19"
product: "booking-link-overlap"
sprint: "sprint-0001-common-slot-mvp"
generated: { by: "hermes-developers/gpt-5.6", at: "2026-08-19T17:53:45Z" }
sources:
  - id: preflight
    resource: /decisions/provider-integration-preflight.md
    title: Provider integration preflight
---

# Developer Plan

## Forecast

Developers forecast PBI-0001 for this Sprint.

## Architecture

- TypeScript application on Node.js 22.
- Express 5 HTTP server serving a responsive, framework-light web UI and a JSON comparison API.
- Provider-neutral domain modules for URL classification, interval coalescing, duration-aware intersection, and response schemas.
- Playwright 1.62 in a server-side Google Appointment Schedule adapter. The adapter forces English UI for stable date parsing, uses a caller-selected browser timezone, paginates seven-day windows, and never submits a booking.
- `calendar.app.google` redirects resolve only through validated HTTPS Google hosts.
- Calendly and Cal.com links are detected and reported transparently until a lawful, tested public-page or credentialed adapter is available.
- Request-local memory only; no database and no analytics.

## Security and privacy

- Allowlist exact provider hosts and reject user-info URLs, non-HTTPS schemes, non-standard ports, private/reserved resolved addresses, and unapproved redirects.
- Bound links (2–10), date range, duration, extraction time, pages, response size, and concurrent browser work.
- Do not log raw booking links. Do not commit real links from the motivating email.
- Add baseline security headers and a restrictive Content Security Policy.

## Delivery slices

1. Domain model, validation, interval coalescing/intersection, and unit tests.
2. Provider classification and SSRF/redirect guard tests.
3. Google browser adapter with static DOM fixture tests and an opt-in live smoke script.
4. JSON API and accessible responsive UI.
5. CI, clean-checkout documentation, build, local browser smoke, and live two-link verification.

## Acceptance and risk-based tests

- Unit: interval union, boundaries, duration, differing source granularity, timezone serialization, invalid inputs.
- Security: unsafe schemes, credentials in URL, unexpected ports, localhost/private IPs, deceptive subdomains, redirect host changes.
- Adapter fixtures: Google page title, duration, seven-day list labels, 12/24-hour time parsing, empty days, pagination termination.
- API integration: all-loaded result, unsupported provider prevents complete output, timeout/failure, no links persisted in response logs.
- Browser: mobile and desktop form flow, keyboard labels, loading/error/empty/results states.
- Live smoke: two user-supplied Google Appointment Schedule links, executed locally and never stored.

## Key risks

- Provider markup can change; adapter failure must remain explicit.
- Browser extraction is slower than API calls; cap range and concurrency.
- Availability can change between comparison and booking; timestamp results and require provider reconfirmation.
- A common interval cannot atomically reserve all providers; this Increment offers safe handoff, not distributed booking.

## Rollback

No persistent state or migration exists. Revert the Increment or disable the experimental adapter without affecting user data.
