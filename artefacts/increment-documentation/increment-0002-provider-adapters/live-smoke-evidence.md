---
type: Validation Evidence
title: Increment 0002 live smoke evidence
status: stable
created: "2026-08-20"
updated: "2026-08-20"
product: "booking-link-overlap"
sprint: "sprint-0002-provider-adapters"
generated: { by: "hermes-tester/gpt-5.6", at: "2026-08-20T14:22:22Z" }
---

# Increment 0002 live smoke evidence

## Scope

Read-only extraction from one publicly accessible Calendly event page and one publicly accessible Cal.com event page. The URLs were supplied only as process arguments, were not logged by the application, and are represented here by SHA-256 fingerprints rather than participant paths.

## Source fingerprints

- Calendly URL SHA-256: `9c70ade96f970124033aa45d29aac38abdd13d831a0513902d4215d7ca8019fe`
- Cal.com URL SHA-256: `d769f25fb6b7a1d739265facac3e21b9d9a2b7f97f7585cff18a6b97c3ffbc1b`

## Command shape

```bash
TZ_NAME=Europe/Berlin DURATION_MINUTES=30 \
  npx tsx scripts/live-smoke.ts '<calendly-public-event>' '<calcom-public-event>'
```

## Results — 2026-08-20

- Calendly: `loaded`, appointment duration 30 minutes.
- Cal.com: `loaded`, appointment duration 30 minutes.
- Comparison: `complete: true`.
- Common windows for the sampled range: 0. This is a valid empty comparison, not a provider failure.
- No appointment-time control was clicked and no booking was submitted.
- The smoke runner printed provider/status/count information only; it did not print source URLs.

## Maximum inclusive 31-date probe

Range: 2026-08-20 through 2026-09-19 in `Europe/Berlin`.

- Calendly: 5.2 seconds, 6 coalesced availability intervals.
- Cal.com: 2.6 seconds, 6 coalesced availability intervals.
- Both completed below the 25-second abort deadline.

## Reproduction note

Use owner-controlled or otherwise authorized public test schedules. A future run can be matched to this evidence by hashing each exact input URL with `shasum -a 256` without committing the URL itself.
