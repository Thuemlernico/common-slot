---
type: Product Goal
title: Working public-link availability intersection MVP
description: Deliver an executable app that finds and presents common slots from multiple public booking links.
status: stable
goal_state: achieved
created: "2026-08-19"
updated: "2026-08-20"
product: "booking-link-overlap"
generated: { by: "hermes-product-owner/gpt-5.6", at: "2026-08-20T14:43:32Z" }
verified: { by: "agent:product-owner", at: "2026-08-20T14:43:32Z" }
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
- A user can compare mixed live Google Appointment Schedule, Calendly, and Cal.com public event links; Google short links are supported.
- The intersection is correct for differing slot lengths and a user-selected meeting duration.
- Unsafe, duplicate, timed-out, incomplete, challenged, or unreadable sources produce an explicit failed status and suppress partial intersections.
- Automated tests cover normalization, intersection, URL/network safety, provider dispatch, semantic extraction fragments, and desktop/mobile handoff.
- Real browser smoke tests demonstrate Google comparison and the Calendly/Cal.com multi-provider workflow without selecting or booking an appointment.
- The source is available in a public GitHub repository under an open-source license.
