---
type: Increment Documentation
title: Multi-provider public availability Increment
description: Experimental fail-closed Calendly and Cal.com adapters integrated with the existing Google comparison.
status: stable
created: "2026-08-20"
updated: "2026-08-20"
product: "booking-link-overlap"
sprint: "sprint-0002-provider-adapters"
pbi_id: "PBI-0002"
generated: { by: "hermes-scrum-team/gpt-5.6", at: "2026-08-20T14:53:54Z" }
verified: { by: "agent:product-owner", at: "2026-08-20T14:53:54Z" }
sources:
  - artefacts/sprints/sprint-0002-provider-adapters/sprint-backlog/pbi-0002-calendly-calcom-adapters.md
  - artefacts/sprints/sprint-0002-provider-adapters/sprint-backlog/sprint-goal.md
  - product-code/README.md
---

# Increment 0002 — Calendly and Cal.com adapters

## Outcome

Common Slot can compare public Google Appointment Schedule, Calendly, and Cal.com event links through one provider-neutral router. Calendly and Cal.com are experimental public-page adapters: they use provider-rendered semantic controls, never call an undocumented availability endpoint, never click an appointment-time control, never submit a booking, and fail closed if markup, duration, date coverage, or redirects cannot be verified.

## Included

- Provider router dispatching exact Google, Calendly, and Cal.com hosts into isolated adapters.
- Calendly extraction from available-day controls, selected-date headings, explicit time controls, and provider-visible duration.
- Cal.com extraction from enabled day controls and timezone-explicit UTC `data-time` controls.
- Exact-host redirect/DNS checks for every document navigation, including `i.cal.com`.
- Provider-neutral canonical schedule identity that strips presentation query parameters and normalizes Cal.com hosts for duplicate detection.
- Three-month render cap, 25-second per-source timeout, abort cleanup, no persistence, and no partial intersection after any source failure.
- Updated UI, generic live-smoke command, mixed-provider API fixtures, and desktop/mobile handoff acceptance coverage.

## Validation evidence

- `npm run check`: 76 Vitest tests passed across 11 files; TypeScript clean build passed.
- `npm run test:e2e`: 8 desktop/mobile Chromium acceptance journeys passed, including mixed Calendly/Cal.com source display and safe provider handoff.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- OKF validator: 0 errors and 0 warnings.
- Privacy scan: no private Google example links, API keys, bearer credentials, or password assignments found in tracked working content.
- Live public smoke on 2026-08-20: Calendly and Cal.com both reached `loaded`; the comparison was complete and returned no common window for the sampled date range. URLs were process inputs only and are not committed.
- The source fingerprints, command shape and sanitized results are recorded in [Live smoke evidence](live-smoke-evidence.md).
- Maximum inclusive 31-date live timing on public examples after DNS-pinning hardening: Calendly 5.2 seconds and Cal.com 2.6 seconds for 2026-08-20 through 2026-09-19, both below the 25-second source limit.
- Local and LAN health checks passed on port 3199; the rebuilt UI advertises all three supported providers.

## Change references

- Implementation and release commit: [`85cee2e`](https://github.com/Thuemlernico/common-slot/commit/85cee2ec24fdba8285bf857811e0fd9a676b7e73).
- Increment diff against the accepted Google/Test-Pyramid baseline: [`04f09d8...85cee2e`](https://github.com/Thuemlernico/common-slot/compare/04f09d810b127662b2e42ba4bffed393bc08c6f1...85cee2ec24fdba8285bf857811e0fd9a676b7e73).
- Release CI: [GitHub Actions run 32382193837](https://github.com/Thuemlernico/common-slot/actions/runs/32382193837), completed successfully.
- Pull Request: none; this increment was integrated by an authorized direct push to `main`.

## Safety evidence

- Production-shaped Chromium fixtures assert that time controls are read but never clicked.
- Date controls and calendar pagination are the only provider calendar interactions.
- Calendly 12/24-hour labels and hour/minute duration forms normalize to UTC intervals.
- Cal.com requires timezone-explicit ISO values and fails closed on malformed enabled time controls.
- Mixed-provider API tests preserve no-partial-result behavior and reject canonical duplicates across `cal.com` / `i.cal.com` and query variants.
- Provider-browser guards reject private-address iframe and subresource destinations rather than limiting SSRF checks to top-level navigation.
- Production Chromium runs behind a loopback CONNECT proxy that validates DNS and connects to the exact selected public IP, closing the DNS validation/connection gap.
- Appointment duration is read only from provider clock/detail controls, never from cancellation or rescheduling prose elsewhere on the page.
- Timeout handling aborts at 25 seconds, awaits cooperative browser cleanup, and bounds non-cooperative cleanup grace to 250 milliseconds; setup failures still close every browser resource created so far.
- Regression tests cover provider-host aliases, mixed valid/malformed Calendly controls, stale Cal.com day controls, unrelated duration text, no-availability duration validity, and an inclusive 31-date range.
- Existing adversarial IPv4/IPv6 SSRF regression suite remains green.

## Known limitations

- Calendly and Cal.com do not expose stable public availability APIs for arbitrary third-party event links; these adapters depend on public booking-page markup and are explicitly experimental.
- Provider bot mitigation, consent UI, localization experiments, or semantic markup changes can cause an explicit failed source.
- Public-page adapters should be replaced with official credentialed APIs where every participant authorizes their own provider account.
- Common Slot performs a handoff, not an atomic reservation. Availability must be reconfirmed on every provider page.
- The three rendered-month cap intentionally rejects farther-future ranges even when the request itself spans no more than 31 days.

## Related

- [Completed PBI-0002 snapshot](pbi-0002-calendly-calcom-adapters.md)
- [Product Owner acceptance](product-owner-acceptance.md)
- [Live smoke evidence](live-smoke-evidence.md)
- [Sprint Goal](../../sprints/sprint-0002-provider-adapters/sprint-backlog/sprint-goal.md)
- Product Code: `product-code/README.md`
