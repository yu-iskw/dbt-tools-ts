# @dbt-tools/core

`@dbt-tools/core` is the TypeScript library that provides artifact parsing, discovery, and analysis for the other dbt-tools packages. CLI, Web, and MCP all build on top of it.

## When to use Core directly

Use `@dbt-tools/core` when you need to:

- Build custom scripts or services in TypeScript that analyze dbt artifacts
- Integrate artifact analysis into an existing TypeScript/Node.js application
- Access lower-level parsed artifact data than the CLI JSON surfaces

If you only need a shell command or a browser UI, use `@dbt-tools/cli` or `@dbt-tools/web` instead.

## Installation

```bash
npm install @dbt-tools/core
# or
pnpm add @dbt-tools/core
```

## Key capabilities

`@dbt-tools/core` provides:

- **Artifact loading** — read `manifest.json`, `run_results.json`, `catalog.json`, and `sources.json` from local paths or remote roots (`s3://`, `gs://`)
- **Discovery** — fuzzy search for models, tests, sources, snapshots, and exposures by name
- **Dependency tracing** — resolve upstream and downstream dependency graphs
- **Run result enrichment** — join manifest metadata with run result execution data
- **Schema version handling** — parse multiple dbt artifact schema versions via `dbt-artifacts-parser`

## Source

The Core package source is under `packages/core/` in the [repository](https://github.com/yu-iskw/dbt-tools-ts).

Refer to the package README and TypeScript types for the full API surface.

## Related

- [Choose by goal](../guide/choose-by-goal.md) — when to use Core vs CLI vs MCP
- [Local and remote artifacts](../concepts/local-and-remote-artifacts.md)
- [dbt Artifacts](../concepts/dbt-artifacts.md)

<!-- markdown-link-check-disable -->

- [@dbt-tools/core on npm](https://www.npmjs.com/package/@dbt-tools/core)

<!-- markdown-link-check-enable -->
