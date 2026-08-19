---
type: Product Decision
title: Provider integration preflight
description: Build a custom intersection core and isolate public-page extraction behind explicit provider adapters.
status: stable
created: "2026-08-19"
updated: "2026-08-19"
product: "booking-link-overlap"
decision: "build-and-wrap"
generated: { by: "hermes-programmer/gpt-5.6", at: "2026-08-19T17:53:45Z" }
sources:
  - id: calcom
    resource: https://github.com/calcom/cal.com
    title: Cal.com scheduling platform
    author: organization:calcom
    last_modified: 2026-08-08
  - id: google-node
    resource: https://github.com/googleapis/google-api-nodejs-client
    title: Official Google APIs Node.js client
    author: organization:googleapis
  - id: calendly-sample
    resource: https://github.com/calendly/buzzwordcrm
    title: Calendly v2 API sample
    author: organization:calendly
  - id: nylas
    resource: https://github.com/nylas/nylas-nodejs
    title: Nylas Node.js SDK
    author: organization:nylas
---

# Decision

Build a small provider-neutral interval and intersection core. Wrap every source behind a provider adapter. Implement Google Appointment Schedule public-page reading as an explicitly experimental browser adapter for the first Increment because Google exposes no documented API that resolves an arbitrary public appointment link into available slots.

# Candidate assessment

- **Cal.com (`calcom/cal.com`, MIT):** mature and actively maintained, but adopting the full platform is far larger than the required link-comparison boundary. Its v2 slots API is useful when the calendar owner supplies credentials. **Reference and future official adapter; do not adopt the platform.**
- **Google APIs Node client (Apache-2.0):** official and actively maintained. Google Calendar FreeBusy requires OAuth access to the calendars and does not expose availability from an arbitrary public Appointment Schedule link. **Use only for a future opt-in OAuth adapter.**
- **Calendly BuzzwordCRM (MIT):** official sample proving Calendly v2 API/OAuth integration, not a reusable availability-intersection product. Public booking links are not API authorization. **Reference for a future credentialed adapter.**
- **Nylas SDK (MIT):** maintained commercial calendar abstraction, but requires connected accounts, adds a paid data processor, and does not satisfy no-credential comparison of arbitrary public links. **Reject for the MVP.**

# Architecture impact

- Availability extraction is server-side; provider secrets never enter browser code.
- The core accepts normalized UTC intervals and does not know provider markup.
- Public-page adapters are isolated, rate-limited, time-bounded, and allowed only for explicit provider hostnames.
- Browser extraction changes can be replaced by official API adapters without rewriting intersection or UI code.
- Every response reports adapter kind and freshness. The product never treats a scraped result as a reservation.

# Risks and controls

- **Markup and bot protection:** browser selectors can break. Keep fixture tests, report failures per source, and never return a partial intersection as complete.
- **Terms and provider policy:** public pages are read only on a user's explicit request. Do not bypass authentication, CAPTCHAs, or rate limits. Reassess provider terms before hosted commercial deployment.
- **SSRF:** accept HTTPS only, allowlist provider hosts, resolve and reject private/reserved IP ranges, and validate redirects.
- **Privacy:** do not persist links, page contents, or availability by default; redact URLs from logs.

# Preflight conclusion

The review changes the initial architecture: there is no trustworthy universal library to adopt. Build the core independently, use Playwright only inside replaceable experimental public-page adapters, and prefer official APIs whenever a participant can authorize their account.
