---
type: Product Vision
title: Common Slot product vision
description: Find a bookable common appointment from several public scheduling links.
status: stable
created: "2026-08-19"
updated: "2026-08-19"
product: "booking-link-overlap"
generated: { by: "hermes-product-owner/gpt-5.6", at: "2026-08-19T17:53:45Z" }
verified: { by: "human:nico", at: "2026-08-19T17:53:45Z" }
sources:
  - id: kickoff
    resource: "Human product direction supplied in the Discord #coding kickoff on 2026-08-19"
    title: Product kickoff and real scheduling example
    author: "human:nico"
---

# Product Vision

For people coordinating a meeting across different scheduling services, **Common Slot** turns several public booking links into one clear view of genuinely shared availability, so arranging a group meeting takes one pass instead of manually comparing calendars or creating duplicate bookings.

# Users and situation

- A coordinator has two or more public booking links from Google Appointment Schedules, Calendly, Cal.com, or similar services.
- The links may expose different appointment durations, time zones, and slot intervals.
- Today the coordinator opens every page, compares times manually, and then books or sends an invitation separately.

# Desired outcome

A user pastes the links, chooses a meeting duration and date range, sees only common windows in one timezone, and can continue safely to the original booking pages.

# Product principles

- No calendar credentials are required for public-link comparison.
- Availability is refreshed close to the booking handoff; stale results are visible.
- Provider-specific behavior stays behind replaceable adapters.
- The product never claims that a slot is reserved before the underlying provider confirms it.
- Private booking links and extracted availability are not persisted by default.
- The repository is public and contains no real links or personal correspondence.

# Boundaries

The first Increment proves the complete comparison workflow with live Google Appointment Schedule links and an extensible provider boundary. Other providers are supported only when their public pages can be read reliably and lawfully; unsupported links fail transparently rather than producing invented availability.
