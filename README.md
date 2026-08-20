# Common Slot

[![CI](https://github.com/Thuemlernico/common-slot/actions/workflows/ci.yml/badge.svg)](https://github.com/Thuemlernico/common-slot/actions/workflows/ci.yml)

Common Slot overlays multiple public scheduling links and shows the time windows that are genuinely available to everyone.

This repository is a product workspace built with Sebastian Keller's [Agile Agentic Framework](https://github.com/se-keller/agile-agentic-framework) at commit `cb4981dd7cfa37ba40dccbc478508c95336e530c`.

## Repository layout

- `product-code/` — executable web application and technical documentation
- `artefacts/` — Product Vision, Product Goal, Product Backlog, Sprint, and Increment evidence in OKF Markdown
- `.aafe/` — explicit product-specific framework extensions
- `AGENTS.md` — operating instructions for agents

## Product direction

The initial goal is an open-source MVP that reads public booking availability, normalizes provider differences, computes common windows, and hands users back to the original providers for final booking. It does not persist private booking links or claim to reserve a slot before a provider confirms it.

See [Product Vision](artefacts/product-backlog/product-vision.md) and [Current Product Goal](artefacts/product-backlog/current-product-goal.md).

## Development status

Increment 0001 established live Google Appointment Schedule comparison. Increment 0002 adds accepted, experimental, fail-closed public-page adapters for Calendly and Cal.com while preserving duration-aware common windows and safe provider handoff.

```bash
cd product-code
npm ci
npx playwright install chromium
npm run dev
```

See [`product-code/README.md`](product-code/README.md) for provider support, privacy and full verification commands. See [Increment 0001](artefacts/increment-documentation/increment-0001-google-common-slot-mvp/increment.md) for acceptance evidence.

## License

MIT. See `LICENSE`.
