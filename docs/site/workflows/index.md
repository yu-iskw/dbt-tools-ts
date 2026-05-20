# Workflows

Short, job-focused guides—each completable in a few minutes. Pick a workflow that matches what you need to do right now.

## Prerequisites (all workflows)

- dbt `target/` with `manifest.json` (and usually `run_results.json`) — see [Choose your interface](../guide/overview.md)

| Workflow                                          | Best for                          |
| ------------------------------------------------- | --------------------------------- |
| [Check run health](check-run-health.md)           | CI and after `dbt run`            |
| [Find a model](find-a-model.md)                   | Fuzzy or partial model names      |
| [Explain a failure](explain-failure.md)           | Why a node failed or blast radius |
| [Investigate slow runs](investigate-slow-runs.md) | Execution time and bottlenecks    |
| [Open in web](open-in-web.md)                     | CLI `web_url` handoff to the UI   |
| [Wire your IDE agent](wire-your-ide-agent.md)     | Cursor, Codex, or Claude plugins  |

Not sure which surface to use? Start at [Choose your interface](../guide/overview.md).
