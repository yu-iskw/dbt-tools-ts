# Ecosystem at a glance

dbt-tools turns dbt artifacts under a **target directory** into structured, repeatable analysis. Four surfaces share the same artifact contract:

| Surface                   | Role                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| **CLI** (`dbt-tools`)     | One-shot shell commands—CI, scripts, operators                                               |
| **MCP** (`dbt-tools-mcp`) | Long-lived server; many tool calls on one parsed run                                         |
| **Web** (`dbt-tools-web`) | Browser investigation UI; startup flags align with MCP (`--dbt-target`, remote client flags) |
| **Agents** (plugins)      | Primitive **skills** that invoke CLI or MCP (Cursor, Codex, Claude Code)                     |

Remote artifact roots (`s3://`, `gs://`, including GCS service-account impersonation): [Local and remote artifacts](../concepts/local-and-remote-artifacts.md).

## Quick examples

From the repository root, with `manifest.json` and `run_results.json` under `./target`:

```bash
dbt-tools status --dbt-target ./target --json
dbt-tools discover --dbt-target ./target "orders" --limit 5 --json
dbt-tools explain model.my_project.my_model --dbt-target ./target --json
```

Replace `model.my_project.my_model` with a `unique_id` from discover output.

**Coding agents:** use stable handles such as `dbt-tools-cli:check-session` and `dbt-tools-cli:find-resources`—see [Skill catalog](agents/skill-catalog.md) and [Install agent skills](agents/install.md).

## Where job recipes live

**Recipes** (sidebar: **Recipes**) are the primary task-oriented entry points:

| Job                 | Recipe                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Debug failures      | [Debug a failed run](../recipes/debug-failed-run.md)                                      |
| Slow models         | [Investigate slow models](../recipes/investigate-slow-models.md)                          |
| Lineage / impact    | [Find model impact](../recipes/find-model-impact.md)                                      |

Full index: [Recipes](../recipes/).

Legacy **workflows** pages keep stable URLs and are linked from package sidebars:

| Job                 | Workflow                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| CI / health         | [Check run health](../workflows/check-run-health.md)                                                                                    |
| Find / explain      | [Find a model](../workflows/find-a-model.md), [Explain a failure](../workflows/explain-failure.md)                                      |
| Slow runs / browser | [Investigate slow runs](../workflows/investigate-slow-runs.md), [Open in web](../workflows/open-in-web.md)                              |
| Coding agent        | [Wire your coding agent](../workflows/wire-your-coding-agent.md)                                                                        |

Workflow index: [Workflows](../workflows/index.md).

## Next

- [Choose your interface](overview.md) — pick CLI, MCP, Web, or agent skills
- [dbt Artifacts](../concepts/dbt-artifacts.md) — what files dbt-tools expects
