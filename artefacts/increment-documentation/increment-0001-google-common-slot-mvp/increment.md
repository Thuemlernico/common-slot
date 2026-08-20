---
type: Increment Documentation
title: Google common-slot MVP Increment
description: A working local web app that compares multiple live Google Appointment Schedule links and safely hands off booking.
status: stable
created: "2026-08-19"
updated: "2026-08-20"
product: "booking-link-overlap"
sprint: "sprint-0001-common-slot-mvp"
pbi_id: "PBI-0001"
generated: { by: "hermes-scrum-team/gpt-5.6", at: "2026-08-19T18:29:33Z" }
verified: { by: "agent:product-owner", at: "2026-08-19T18:29:33Z" }
sources:
  - artefacts/product-backlog/product-vision.md
  - artefacts/sprints/sprint-0001-common-slot-mvp/sprint-backlog/sprint-goal.md
  - product-code/README.md
---

# Increment 0001 — Google common-slot MVP

## Outcome

A user can paste 2–10 public booking links, select a date range, timezone and required duration, and receive only continuous windows shared by every successfully loaded source. The first live provider adapter supports Google Appointment Schedules, including Google short links. The user selects a result before provider booking links are exposed; Common Slot never books or stores an appointment.

## Included

- Provider classification for Google, Calendly, Cal.com and unknown hosts.
- Live Google Appointment Schedule extraction with bounded pagination, timezone-aware parsing and short-link resolution.
- Provider-neutral interval intersection and duration filtering.
- Explicit incomplete states: unsupported or failed sources suppress partial common times.
- Responsive accessible UI with stale-result protection and safe booking handoff.
- SSRF controls, exact provider allowlist, redirect checks, mapped-IP rejection, CSP and bounded browser work.
- Unit, integration and desktop/mobile browser tests plus an opt-in live smoke command.

## Validation evidence

- `npm run check`: 53 tests passed across 7 files; TypeScript build passed. This comprises 37 unit/schema/security tests and 16 integration/API/parser tests.
- `npm run test:e2e`: 8 desktop/mobile Chromium acceptance journeys passed, covering success, safe handoff, stale results, link-count validation, loading, incomplete/no-partial, empty and API-error states.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- OKF validator: 0 errors and 0 warnings.
- Live smoke using the two Google links from the 2026-08-19 Tom/Dotter coordination example: both sources loaded, comparison complete, four currently common windows returned on 2026-08-20. The source URLs are not stored in this repository.
- Independent pre-commit review findings were remediated with regression coverage for duplicate canonical schedules, hard timeouts, IPv4-mapped IPv6 addresses, production-shaped Google markup and cross-year date parsing.

## Test pyramid and UAT retest — 2026-08-20

- Three read-only agents independently exercised the unit/integration/security layer, browser/UAT layer and release-evidence layer against commit `4ab63a5`.
- Their initial release blocker was reproduced: unsafe Calendly/Cal.com schemes were classified as unsupported before URL-policy validation. The production path now applies HTTPS, credential, port, host and DNS policy to every detected provider before reporting support status; focused regression tests pass.
- Adversarial IPv6 probes exposed site-local and transition forms that could embed private IPv4 destinations. Site-local, Teredo, benchmarking and ORCHID ranges now fail closed; NAT64 and 6to4 forms inherit the embedded IPv4 policy. Private negative and public positive controls pass.
- UAT exposed a misleading secondary date error for an invalid timezone. Schema validation now reports only the actionable timezone error.
- Deletion-sensitive checks verify that Google availability extraction never clicks appointment-slot controls and that booking handoff shows the exact warning, original provider URLs and safe link attributes.
- Manual retest against the rebuilt local server confirms unsafe schemes return `failed`, no partial results are produced, invalid timezone feedback is singular, and the health endpoint remains available.

## Known limitations

- Calendly and Cal.com are detected but intentionally reported as unsupported in this Increment; no partial or fabricated availability is shown.
- Google public-page extraction is experimental because provider DOM changes can break it. The adapter fails closed when the schedule shell is not recognized.
- Common Slot performs a handoff rather than a booking transaction. Availability must be reconfirmed on the provider page.
- Requested Google dates are bounded to the eight-week provider-page horizon to keep browser work predictable.

## Related

- [Completed PBI-0001](pbi-0001-compare-public-booking-links.md)
- [Sprint Goal](../../sprints/sprint-0001-common-slot-mvp/sprint-backlog/sprint-goal.md)
- Product Code: `product-code/README.md`
