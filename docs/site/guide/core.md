# @dbt-tools/core

**Composable analysis substrate** for dbt artifacts: manifest graphs, execution analysis, snapshots, exports, and shared discovery logic used by the CLI, MCP server, and web UI.

## When to use core

Use `@dbt-tools/core` when you need programmatic access to the same analysis engine as the shipped tools—custom automation, embedded workflows, or building on top of dependency graphs and execution timelines.

## Install

```bash
npm install @dbt-tools/core
```

For browser-safe APIs (workers, no Node built-ins), import from `@dbt-tools/core/browser`.

## Learn more

- Package README: [`packages/core/README.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/core/README.md)
- Product positioning: [ADR-0008](https://github.com/yu-iskw/dbt-tools-ts/blob/main/docs/adr/0008-dbt-tools-operational-intelligence-and-positioning-boundaries.md)
