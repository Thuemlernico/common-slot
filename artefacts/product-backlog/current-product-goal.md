---
type: Product Goal
title: Working public-link availability intersection MVP
description: Deliver an executable app that finds and presents common slots from multiple public booking links.
status: stable
goal_state: achieved
created: "2026-08-19"
updated: "2026-08-19"
product: "booking-link-overlap"
generated: { by: "hermes-product-owner/gpt-5.6", at: "2026-08-19T17:53:45Z" }
verified: { by: "human:nico", at: "2026-08-19T17:53:45Z" }
sources:
  - id: kickoff
    resource: "Human product direction supplied in the Discord #coding kickoff on 2026-08-19"
    title: Build request and public-repository authorization
    author: "human:nico"
---

# Current Product Goal

Publish a usable open-source MVP that accepts multiple public scheduling links, reads live availability from supported providers, normalizes duration and timezone differences, displays the common bookable windows, and hands the user back to the original provider pages without claiming or causing a double booking.

# Evidence of goal achievement

- The app runs from a clean checkout with documented commands.
- A user can compare at least two live Google Appointment Schedule links, including a `calendar.app.google` short link.
- The intersection is correct for differing slot lengths and a user-selected meeting duration.
- Unsupported or unreadable providers produce an explicit per-link status.
- Automated tests cover normalization, intersection, URL safety, and extraction fixtures.
- A real browser smoke test demonstrates the workflow.
- The source is available in a public GitHub repository under an open-source license.
