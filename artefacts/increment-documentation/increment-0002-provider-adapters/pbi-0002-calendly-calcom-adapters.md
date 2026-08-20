---
type: Product Backlog Item
title: Add safe Calendly and Cal.com availability adapters
status: stable
created: "2026-08-19"
updated: "2026-08-20"
product: "booking-link-overlap"
id: "PBI-0002"
backlog_state: done
sources:
  - artefacts/sprints/sprint-0002-provider-adapters/sprint-backlog/pbi-0002-calendly-calcom-adapters.md
---

# PBI-0002 — Completed acceptance snapshot

## Outcome

Public Calendly and Cal.com event links participate in the same complete, duration-aware comparison as Google Appointment Schedule links through isolated experimental public-page adapters.

## Accepted boundaries

- Exact HTTPS provider hosts, redirects, aliases, DNS/IP destinations, iframes, subresources, and WebSockets are checked before network access.
- Calendly availability comes only from enabled available-day and explicit time controls; any malformed enabled time control fails the source.
- Cal.com availability comes only from enabled day controls and timezone-explicit `data-time` values bound to the selected local date.
- Appointment-time controls are read but never clicked. Common Slot never submits a booking.
- Every source must load for an intersection; failed, unsafe, duplicate, timed-out, incomplete, challenged, or unrecognized sources suppress partial results.
- Public-page extraction requires no provider credentials. Official credentialed APIs remain preferred when all participants authorize their accounts.

## Acceptance evidence

- 76 Vitest unit/integration/security tests passed across 11 files.
- 8 desktop/mobile Playwright UAT journeys passed.
- Live public smoke loaded one Calendly and one Cal.com event without clicking time controls or booking.
- Maximum inclusive 31-date extraction completed below the 25-second abort deadline for both new providers.
- Dependency audit found zero vulnerabilities; OKF validation returned zero errors and warnings.
- Initial independent release review failed and drove regression fixes for subresource/WebSocket SSRF, cleanup, host aliases, stale-day controls, duration parsing, malformed controls, and inclusive range semantics.

## Related

- [Increment 0002](increment.md)
- [Live smoke evidence](live-smoke-evidence.md)
- [Product Owner acceptance](product-owner-acceptance.md)
