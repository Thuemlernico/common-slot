# Product workspace instructions

Read `README.md` before acting. Use the configured Agile Agentic Framework as the base and apply only additions and explicit overrides declared in `.aafe/aafe.yaml`.

## Entry point

Start with the Product Owner unless the human explicitly selects another available agent. The Product Owner must inspect existing `artefacts/` and relevant `product-code/` context before asking questions. Resume established product direction instead of restarting discovery.

When product direction and at least one ready PBI exist, hand lifecycle control to the Scrum Master. Let it activate configured participants and run the event-driven Sprint without assigning Developer work.

## Boundaries

- Use the framework's `okf` skill for product knowledge and result artifacts under `artefacts/`.
- Preserve each artifact's `created` date and update its `updated` date in `YYYY-MM-DD` format whenever its content or metadata changes.
- Keep Product Code under `product-code/`; never place it under `artefacts/` or `artefacts/increment-documentation/`.
- Allow only agents with Product Code write permission to modify `product-code/`.
- Put product-specific framework changes under `.aafe/`; do not modify the base framework.
- Treat same-name agent or skill collisions as errors unless `.aafe/aafe.yaml` explicitly declares an override.
- Keep `.aafe` skill folders minimal. Do not create `agents/` or `agents/openai.yaml` unless a concrete runtime integration explicitly requires that metadata.
- Keep Product Vision and the current Product Goal under `artefacts/product-backlog/` with its index and available PBI items.
- During Planning, move selected PBI files from `artefacts/product-backlog/items/` into the Sprint's `sprint-backlog/`. Keep Done PBIs and resolved Bugs there; return unfinished work to the Product Backlog and preserve a return link in the Sprint Backlog index.
- Store the agreed Sprint Goal inside the Sprint Backlog as `sprint-backlog/sprint-goal.md`.
