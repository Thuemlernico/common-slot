---
type: Product Backlog Item
title: Add safe Calendly and Cal.com availability adapters
description: Let users compare Calendly and Cal.com links without hiding authentication, reliability, or provider-policy constraints.
status: draft
created: "2026-08-19"
updated: "2026-08-19"
product: "booking-link-overlap"
id: "PBI-0002"
backlog_state: refinement
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
- Required account authorization, API credentials, or plan limitations are explained before extraction starts.
- A provider without the required authorization remains explicit and cannot contribute to a complete intersection.
- Redirect, SSRF, timeout, rate-limit, privacy, and no-booking safeguards remain equivalent to the Google adapter.
- Provider-owned fixtures and opt-in live smoke checks cover each adapter without committing real customer links or credentials.
- Common results preserve the same timezone, duration, freshness, and handoff semantics as Google results.

## Current discovery

The first Increment deliberately detects these providers but fails closed. Official routes require additional investigation and likely participant authorization; undocumented public-page endpoints are not an acceptable production contract by themselves.
