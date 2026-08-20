---
type: Developer Plan
title: Calendly and Cal.com adapter developer plan
description: Test-driven implementation plan for experimental public booking page adapters.
status: stable
created: "2026-08-20"
updated: "2026-08-20"
product: "booking-link-overlap"
sprint: "sprint-0002-provider-adapters"
generated: { by: "hermes-developers/gpt-5.6", at: "2026-08-20T13:28:25Z" }
sources:
  - id: preflight
    resource: /decisions/provider-integration-preflight.md
    title: Provider integration preflight
---

# Developer Plan

## Forecast

Developers forecast PBI-0002 for this Sprint.

## Architecture

- Keep the UTC interval/intersection core provider-neutral.
- Add an extractor router for Google, Calendly, and Cal.com.
- Read only semantic public booking controls in isolated Playwright contexts; never use private or undocumented availability endpoints.
- Click only available-day and calendar-pagination controls. Appointment-time controls are read but never clicked.
- Apply exact-host, HTTPS, DNS, redirect, timeout, date-range, and markup-completeness guards at every adapter boundary.

## Test-first slices

1. Red API tests for mixed-provider loading and duplicate canonical identities.
2. Red fixture tests for Calendly duration, date/time controls, empty states, malformed markup, and month pagination.
3. Red fixture tests for Cal.com duration, UTC `data-time` controls, empty states, malformed markup, and month pagination.
4. Implement adapters and router with dependency injection.
5. Extend E2E/UAT states, opt-in live smoke, security regression suite, and release evidence.

## Release gate

- Build, complete Vitest suite, Playwright desktop/mobile UAT, dependency audit, OKF validation, and privacy scan.
- Live smoke against one public opt-in example per provider without storing links or clicking time controls.
- Independent security and acceptance review against the exact staged tree.

## Rollback

Adapters are isolated and stateless. Revert the Increment or disable a provider route without data migration.