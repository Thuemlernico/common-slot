---
type: Product Backlog Item
title: Add safe Calendly and Cal.com availability adapters
description: Let users compare Calendly and Cal.com links without hiding authentication, reliability, or provider-policy constraints.
status: stable
created: "2026-08-19"
updated: "2026-08-20"
product: "booking-link-overlap"
id: "PBI-0002"
backlog_state: done
sources:
  - type: Artifact
    resource: artefacts/decisions/provider-integration-preflight.md
    verified:
      at: "2026-08-19T17:53:45Z"
      by: agent
---

# Add safe Calendly and Cal.com availability adapters

## Outcome

People can include Calendly and Cal.com scheduling sources in the same comparison as Google links, with explicit setup and failure behavior rather than brittle silent scraping.

## Acceptance boundaries

- Calendly and Cal.com sources can reach `loaded` through a documented, lawful integration path.
- Public-event extraction requires no account credential; official credentialed APIs remain the preferred path when all participants authorize their accounts.
- A provider without the required authorization remains explicit and cannot contribute to a complete intersection.
- Redirect, SSRF, timeout, rate-limit, privacy, and no-booking safeguards remain equivalent to the Google adapter.
- Provider-selector-shaped Chromium fixtures and opt-in live smoke checks cover each adapter without committing real customer links or credentials.
- Common results preserve the same timezone, duration, freshness, and handoff semantics as Google results.

## Current discovery

The first Increment deliberately detected these providers and failed closed. The second Increment uses the providers' public, semantic booking interfaces through isolated Playwright adapters. It does not call undocumented availability APIs, bypass authentication or bot protection, click appointment-time controls, or submit bookings. The adapters are experimental and fail closed when provider markup or the complete requested range cannot be recognized.

## Acceptance examples

- A valid public Calendly event link contributes normalized UTC intervals by reading available-day and time controls without clicking a time.
- A valid public Cal.com event link contributes normalized UTC intervals from `data-time` controls without clicking a time.
- Mixed Google, Calendly, and Cal.com sources can produce a complete duration-aware intersection.
- Provider redirects remain on exact allowlisted hosts and are DNS-validated at every document navigation.
- Unsupported page types, authentication challenges, unavailable ranges, malformed controls, and unsafe URLs fail explicitly and produce no partial result.
