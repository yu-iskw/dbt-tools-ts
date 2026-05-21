# Choose by goal

Start with the job you need to finish, then pick the interface that fits. Package-oriented detail stays in [Choose your interface](./overview.md) and [Ecosystem at a glance](./ecosystem.md).

## Decision table

| Goal                                          | Best interface | Why                                                    | Start here                                                                                        |
| --------------------------------------------- | -------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Check whether a run succeeded                 | CLI            | Fast, scriptable, JSON output                          | [Check run health](../workflows/check-run-health.md)                                              |
| Debug a failed model or test                  | CLI + Web      | CLI summarizes; Web adds lineage and execution context | [Debug a failed run](../recipes/debug-failed-run.md)                                              |
| Investigate slow models                       | Web + CLI      | Web for timelines; CLI for ranked execution lists      | [Investigate slow models](../recipes/investigate-slow-models.md)                                  |
| Understand upstream/downstream impact         | CLI + Web      | `discover`, `explain`, `deps`; Web for graph views     | [Find model impact](../recipes/find-model-impact.md)                                              |
| Let a coding agent query artifacts repeatedly | MCP            | Long-lived server with resident parsed cache           | [Wire your coding agent](../workflows/wire-your-coding-agent.md)                                  |
| Automate in CI                                | CLI            | Deterministic shell and JSON                           | [Check run health](../workflows/check-run-health.md)                                              |
| Build custom TypeScript tooling               | Core           | Programmatic API in `@dbt-tools/core`                  | [packages/core README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/core/README.md) |
| Load artifacts from object storage            | CLI, Web, MCP  | Same `--dbt-target` root across surfaces               | [Local and remote artifacts](../concepts/local-and-remote-artifacts.md)                           |

## How this relates to other pages

| Page                                    | Role                                        |
| --------------------------------------- | ------------------------------------------- |
| [5-minute quickstart](./quickstart.md)  | Hands-on path with demo artifacts           |
| [Choose your interface](./overview.md)  | Surface picker (CLI / MCP / Web / agents)   |
| [Ecosystem at a glance](./ecosystem.md) | Shared artifact contract and workflow index |
| [Recipes](../recipes/)                  | Task-oriented end-to-end guides             |

## Prerequisites

- `manifest.json` and `run_results.json` under a target root (local `target/`, remote prefix, or [demo artifacts](./demo-artifacts.md))
- Node.js 20+
