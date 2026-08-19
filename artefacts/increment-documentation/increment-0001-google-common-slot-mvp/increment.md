---
type: Increment Documentation
title: Google common-slot MVP Increment
description: A working local web app that compares multiple live Google Appointment Schedule links and safely hands off booking.
status: stable
created: "2026-08-19"
updated: "2026-08-19"
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

- `npm run check`: 36 tests passed across 6 files; build passed.
- `npm run test:e2e`: desktop and mobile Chromium journeys passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- OKF validator: 0 errors and 0 warnings.
- Live smoke using the two Google links from the 2026-08-19 Tom/Dotter coordination example: both sources loaded, comparison complete, five common windows returned. The private source URLs are not stored in this repository.
- Independent pre-commit review findings were remediated with regression coverage for duplicate canonical schedules, hard timeouts, IPv4-mapped IPv6 addresses, production-shaped Google markup and cross-year date parsing.

## Known limitations

- Calendly and Cal.com are detected but intentionally reported as unsupported in this Increment; no partial or fabricated availability is shown.
- Google public-page extraction is experimental because provider DOM changes can break it. The adapter fails closed when the schedule shell is not recognized.
- Common Slot performs a handoff rather than a booking transaction. Availability must be reconfirmed on the provider page.
- Requested Google dates are bounded to the eight-week provider-page horizon to keep browser work predictable.

## Related

- [Completed PBI-0001](pbi-0001-compare-public-booking-links.md)
- [Sprint Goal](../../sprints/sprint-0001-common-slot-mvp/sprint-backlog/sprint-goal.md)
- Product Code: `product-code/README.md`
