---
type: Sprint Retrospective
title: Sprint 0002 retrospective
status: stable
created: "2026-08-20"
updated: "2026-08-20"
product: "booking-link-overlap"
sprint: "sprint-0002-provider-adapters"
generated: { by: "hermes-scrum-team/gpt-5.6", at: "2026-08-20T14:00:08Z" }
sources:
  - artefacts/sprints/sprint-0002-provider-adapters/developer-plan.md
  - artefacts/increment-documentation/increment-0002-provider-adapters/increment.md
---

# Sprint 0002 Retrospective

## What helped

- Separate read-only agents inspected current Calendly and Cal.com semantic markup before the implementation contract was finalized.
- The provider-neutral interval core and extractor interface needed no redesign; a small router isolated provider-specific behavior.
- Red-first parser and router tests exposed unsupported-provider branching before it could survive into the release.
- Live smoke testing caught a real Calendly consent overlay and a brittle month-change wait that static fixtures did not reveal.
- Exact provider attributes (`data-container="time-button"`, `data-testid="selected-month-label"`, `data-time`) made accidental time clicks and locale-dependent inference less likely.
- Independent release review exposed subresource SSRF, cleanup, provider-alias, stale-day, duration, malformed-control, and inclusive-range gaps; deletion-sensitive regressions now protect every remediation.

## What slowed us down

- Calendly's consent shell could intercept pointer input even after a privacy choice; using date-control DOM activation avoided both cookie interaction and appointment-time interaction.
- Body-wide month parsing was initially too broad because selected-date text can retain the previous month after pagination.
- The first documentation and UI still described Calendly/Cal.com as unsupported after the backend became provider-neutral.

## Improvement for the next Sprint

Build stateful provider fixtures that rerender exact production-shaped month/day/time controls on date and pagination interaction. Add a scheduled opt-in smoke against public owner-controlled test events so markup drift is detected before users do.

Keep official credentialed APIs as the preferred future path when every participant can authorize their own account; do not reverse-engineer provider-internal availability endpoints.
