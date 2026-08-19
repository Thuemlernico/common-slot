# Contributing

Contributions are welcome. Common Slot is deliberately small: keep provider quirks behind adapters and keep the interval/intersection core provider-neutral.

## Before changing code

1. Read the Product Vision, current Product Goal, active Sprint Goal, and selected PBI under `artefacts/`.
2. Read `AGENTS.md`; this repository uses Sebastian Keller's Agile Agentic Framework.
3. Work inside `product-code/` for application source, tests, and technical documentation.
4. Do not add a provider adapter based only on an undocumented endpoint discovered in browser traffic. Record the provider's supported API or public-page contract, authentication requirements, license/terms risk, and failure behavior.

## Quality expectations

From `product-code/`:

```bash
npm ci
npm test
npm run build
```

Changes to parsing, URL validation, redirects, interval arithmetic, or provider adapters need boundary and adversarial tests. Browser adapters also need sanitized static fixtures and an optional live smoke that never submits a booking.

## Privacy and security

- Never commit real booking links, calendar data, correspondence, credentials, cookies, or browser profiles.
- Use exact provider hostname allowlists and retain the SSRF/redirect checks.
- Do not bypass authentication, CAPTCHAs, rate limits, or provider controls.
- Never click a time slot or submit a booking while extracting availability.

Report vulnerabilities through GitHub private vulnerability reporting, not public issues. See `SECURITY.md`.
