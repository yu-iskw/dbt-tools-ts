# Choose your interface

How the pieces fit together: [Ecosystem at a glance](./ecosystem.md). For job-first routing, see [Choose by goal](./choose-by-goal.md) and [Recipes](../recipes/).

<!-- markdown-link-check-disable -->

| If you want to…                                  | Use                                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Start in five minutes with demo artifacts        | [5-minute quickstart](./quickstart.md)                                                             |
| Pick a path by problem (failed run, slow models) | [Choose by goal](./choose-by-goal.md) · [Recipes](../recipes/)                                     |
| Follow a step-by-step job                        | [Ecosystem at a glance](./ecosystem.md)                                                            |
| Run one-shot commands in CI or shell             | [@dbt-tools/cli](https://www.npmjs.com/package/@dbt-tools/cli) · [guide](./cli/getting-started.md) |
| Let a coding agent query the same run many times | [@dbt-tools/mcp](https://www.npmjs.com/package/@dbt-tools/mcp) · [guide](./mcp/getting-started.md) |
| Explore lineage and runs in a browser            | [@dbt-tools/web](https://www.npmjs.com/package/@dbt-tools/web) · [guide](./web/getting-started.md) |
| Install agent skills (Cursor, Codex, Claude)     | [Agents](./agents/install.md)                                                                      |

<!-- markdown-link-check-enable -->

## Prerequisites

- A dbt project with `manifest.json` and `run_results.json` under `target/`
- Node.js 20+ (see the repository [`.node-version`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.node-version) for development)
