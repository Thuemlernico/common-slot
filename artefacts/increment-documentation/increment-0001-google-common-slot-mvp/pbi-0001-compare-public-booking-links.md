---
type: Product Backlog Item
title: Compare public booking links and show common slots
description: Deliver the complete first user journey from pasted links to safe booking handoff.
status: stable
created: "2026-08-19"
updated: "2026-08-19"
product: "booking-link-overlap"
pbi_id: "PBI-0001"
backlog_state: done
priority: 1
generated: { by: "hermes-product-owner/gpt-5.6", at: "2026-08-19T17:53:45Z" }
verified: { by: "human:nico", at: "2026-08-19T17:53:45Z" }
sources:
  - id: kickoff
    resource: "Human product direction supplied in the Discord #coding kickoff on 2026-08-19"
    title: Product kickoff and scheduling example
    author: "human:nico"
---

# PBI-0001 — Compare public booking links and show common slots

As a meeting coordinator, I want to combine several public scheduling links into a single availability view, so that I can find and book a time everyone can attend without comparing every page manually.

# Acceptance Criteria

1. The app accepts between two and ten HTTPS booking links and labels each detected provider.
2. Live Google Appointment Schedule links in both canonical and `calendar.app.google` short-link form can be read without requiring the user to sign in.
3. The user can choose a date range, target timezone, and meeting duration.
4. Provider slots are normalized as time intervals; a displayed result exists only when every successfully loaded participant has a continuous available interval at least as long as the chosen duration.
5. Different source appointment lengths and slot increments do not create false overlaps.
6. Each source reports `loaded`, `unsupported`, or `failed` explicitly. The app does not silently calculate a partial intersection when any requested source is unavailable.
7. Selecting a common result shows the original provider links and warns that availability must be reconfirmed before final booking; the app does not create multiple bookings itself.
8. Public-link data is processed in memory and is not persisted by default.
9. Invalid schemes, private-network targets, and unsafe redirects are rejected.
10. The repository contains no real customer links, correspondence, credentials, or personal test data.
11. A clean checkout has documented install, test, build, and run commands, and CI exercises the automated suite.
12. The user interface works on desktop and mobile and communicates loading, empty, error, and stale-result states accessibly.

# Verifiable Examples

- Given two 30-minute Google schedules with availability at 12:00, a 30-minute request returns 12:00.
- Given one 60-minute source available 12:00–13:00 and one 30-minute source available at 12:00 and 12:30, a 60-minute request returns 12:00 only when the shorter slots form one continuous interval.
- Given a supported link and one unsupported link, no common slots are presented as complete results.
- Given `http://127.0.0.1:3000`, the source is rejected before any network request.

# Known uncertainties

- Provider page markup and public endpoints can change without notice.
- Calendly and Cal.com support depends on what their public pages and terms allow; the adapter boundary must make this limitation transparent.
