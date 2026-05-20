# Choose your interface

| If you want to…                                  | Use                                     |
| ------------------------------------------------ | --------------------------------------- |
| Run one-shot commands in CI or shell             | [@dbt-tools/cli](./cli/getting-started) |
| Let a coding agent query the same run many times | [@dbt-tools/mcp](./mcp/getting-started) |
| Explore lineage and runs in a browser            | [@dbt-tools/web](./web/getting-started) |
| Install agent skills (Cursor, Codex, Claude)     | [Agents](./agents/) (docs coming)       |

## Prerequisites

- A dbt project with `manifest.json` and `run_results.json` under `target/`
- Node.js 20+ (see the repository [`.node-version`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.node-version) for development)
