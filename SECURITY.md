# Security Policy

## Reporting a vulnerability

Please do not open a public issue for vulnerabilities. Use GitHub's private vulnerability reporting for this repository.

Include the affected version, reproduction steps, impact, and any suggested mitigation. Do not test against booking links or calendars you do not control.

## Security model

Common Slot processes user-supplied public scheduling links. Provider adapters must:

- accept HTTPS only;
- use exact hostname allowlists;
- reject credentials in URLs, non-standard ports, private/reserved IP addresses, and unsafe redirects;
- never bypass sign-in, CAPTCHA, rate limits, or provider access controls;
- never submit or reserve a booking during availability extraction;
- avoid persisting raw links or extracted availability by default; and
- bound execution time, page count, input count, and response size.

Browser-based public-page adapters are experimental. Their output is availability evidence, not a reservation. Users must reconfirm the slot with each underlying provider before booking.

## Supported versions

Security fixes currently target the latest commit on `main` while the project is pre-1.0.
