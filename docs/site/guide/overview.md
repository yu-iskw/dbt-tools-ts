# Choose your interface

How the pieces fit together: [Ecosystem at a glance](./ecosystem.md). Not sure which interface you need? Try [Choose by goal](./choose-by-goal.md) or the [5-minute quickstart](./quickstart.md).

<!-- markdown-link-check-disable -->

| If you want to…                                  | Use                                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Follow a step-by-step job                        | [Recipes](../recipes/) or [Ecosystem at a glance](./ecosystem.md)                                  |
| Run one-shot commands in CI or shell             | [@dbt-tools/cli](https://www.npmjs.com/package/@dbt-tools/cli) · [guide](./cli/getting-started.md) |
| Let a coding agent query the same run many times | [@dbt-tools/mcp](https://www.npmjs.com/package/@dbt-tools/mcp) · [guide](./mcp/getting-started.md) |
| Explore lineage and runs in a browser            | [@dbt-tools/web](https://www.npmjs.com/package/@dbt-tools/web) · [guide](./web/getting-started.md) |
| Install agent skills (Cursor, Codex, Claude)     | [Agents](./agents/install.md)                                                                      |
| Build custom TypeScript tooling                  | [@dbt-tools/core](../reference/core.md)                                                            |

<!-- markdown-link-check-enable -->

## Prerequisites

- A dbt project with `manifest.json` and `run_results.json` under `target/`
- Node.js 20+ for published packages; monorepo development uses [`.mise.toml`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.mise.toml) / [`.node-version`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.node-version) (optional [mise](https://mise.jdx.dev/): `mise trust && mise install`)

> **No dbt project?** Use [Try with a sample project](./try-with-sample-project.md) to generate artifacts with a public sample repo (no warehouse required for the default path).

## Related

- [5-minute quickstart](./quickstart.md) — run your first command
- [Choose by goal](./choose-by-goal.md) — route by job-to-be-done
- [Deploy](../deploy/) — local, S3, GCS, and CI configuration
- [Trust & Safety](../trust/) — data boundaries and agent safety
