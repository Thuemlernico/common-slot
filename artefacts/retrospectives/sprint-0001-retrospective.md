---
type: Sprint Retrospective
title: Sprint 0001 retrospective
status: stable
created: "2026-08-19"
updated: "2026-08-19"
product: "booking-link-overlap"
sprint: "sprint-0001-common-slot-mvp"
generated: { by: "hermes-scrum-team/gpt-5.6", at: "2026-08-19T18:29:33Z" }
sources:
  - artefacts/sprints/sprint-0001-common-slot-mvp/developer-plan.md
  - artefacts/increment-documentation/increment-0001-google-common-slot-mvp/increment.md
---

# Sprint 0001 Retrospective

## What helped

- A real email coordination case supplied a concrete live acceptance example.
- Provider-neutral interval logic kept the reliable domain core separate from fragile provider extraction.
- Production-shaped fixtures and live smoke checks caught Google DOM and short-link timing defects that synthetic happy paths missed.
- Independent review found release blockers before publication: date-horizon handling, false-success markup, canonical duplicates, cooperative-only timeout and mapped IPv6 filtering.

## What slowed us down

- Repeated builds initially nested static assets and served stale JavaScript.
- Fixed sleeps made the Google adapter transiently return zero common windows.
- Early acceptance tests verified stale labels but not that stale handoff actions were actually disabled.

## Improvement for the next Sprint

For every new provider adapter, require three test layers before acceptance: production-shaped semantic markup, a fail-closed drift fixture, and an opt-in live smoke. Treat canonical participant identity and hard resource deadlines as shared adapter-contract concerns rather than provider-specific afterthoughts.

No base-framework or permission changes are proposed.
