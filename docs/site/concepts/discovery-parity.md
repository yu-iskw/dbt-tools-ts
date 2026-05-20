# Same discovery everywhere

dbt-tools uses **one ranking contract** for resource discovery across the CLI and the web investigation UI. The goal is the same question—“which resource did you mean?”—with the same reasons, not two different search implementations.

## Shared behavior

- **CLI** `dbt-tools discover` returns ranked matches with scores, `reasons`, and optional disambiguation hints.
- **Web** discover/inventory views apply the same ranking entry point in the analysis worker ([ADR-0010](https://github.com/yu-iskw/dbt-tools-ts/blob/main/docs/adr/0010-shared-discovery-ranker-intent-commands-and-cli-web-deep-links.md)).
- **Query tokens** such as `type:model`, `tag:`, and package filters align between CLI flags and inline tokens.

## Why it matters

- Operators can start in the terminal and continue in the browser without re-guessing names.
- Agents and scripts get stable JSON they can replay in the UI via [deep links](../reference/deep-links.md).
- `search` remains available for legacy-style output; **`discover`** is the explainable, preferred path for new workflows.

## Try it

1. [Find a model](../workflows/find-a-model.md) with the CLI.
2. Open the web app and run the same query in discover.
3. Set `DBT_TOOLS_WEB_BASE_URL` and use [Open in web](../workflows/open-in-web.md) for one-click handoff.

## Learn more

- [Operational intelligence](./operational-intelligence.md)
- [CLI cheatsheet](../reference/cli-cheatsheet.md)
