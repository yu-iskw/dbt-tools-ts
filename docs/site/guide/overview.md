# Choose your interface

How the pieces fit together: [Ecosystem at a glance](./ecosystem.md).

| If you want to…                                  | Use                                        |
| ------------------------------------------------ | ------------------------------------------ |
| Follow a step-by-step job                        | [Ecosystem at a glance](./ecosystem.md)    |
| Run one-shot commands in CI or shell             | [@dbt-tools/cli](./cli/getting-started.md) |
| Let a coding agent query the same run many times | [@dbt-tools/mcp](./mcp/getting-started.md) |
| Explore lineage and runs in a browser            | [@dbt-tools/web](./web/getting-started.md) |
| Install agent skills (Cursor, Codex, Claude)     | [Agents](./agents/install.md)              |

## Prerequisites

- A dbt project with `manifest.json` and `run_results.json` under `target/`
- Node.js 20+ (see the repository [`.node-version`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.node-version) for development)
