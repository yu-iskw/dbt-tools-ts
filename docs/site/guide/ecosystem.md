# Ecosystem at a glance

dbt-tools turns dbt artifacts under a **target directory** into structured, repeatable analysis. Four surfaces share the same artifact contract:

| Surface                   | Role                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| **CLI** (`dbt-tools`)     | One-shot shell commands—CI, scripts, operators                                               |
| **MCP** (`dbt-tools-mcp`) | Long-lived server; many tool calls on one parsed run                                         |
| **Web** (`dbt-tools-web`) | Browser investigation UI; startup flags align with MCP (`--dbt-target`, remote client flags) |
| **Agents** (plugins)      | Primitive **skills** that invoke CLI or MCP (Cursor, Codex, Claude Code)                     |

These surfaces share `@dbt-tools/core` as the analysis library. End users install CLI, Web, or MCP — not core. See [Core (advanced)](../reference/core.md).

Remote artifact roots (`s3://`, `gs://`, including GCS service-account impersonation): [Local and remote artifacts](../concepts/local-and-remote-artifacts.md) · [S3](../deploy/s3.md) · [GCS](../deploy/gcs.md).

## Quick examples

From the repository root, with `manifest.json` and `run_results.json` under `./target`:

```bash
dbt-tools status --dbt-target ./target --json
dbt-tools discover --dbt-target ./target "orders" --limit 5 --json
dbt-tools explain model.my_project.my_model --dbt-target ./target --json
```

Replace `model.my_project.my_model` with a `unique_id` from discover output.

**Coding agents:** use stable handles such as `dbt-tools-cli:check-session` and `dbt-tools-cli:find-resources`—see [Skill catalog](agents/skill-catalog.md) and [Install agent skills](agents/install.md).

## Where recipes and job workflows live

**Recipes** (goal-first): [recipes/](../recipes/) — start with what you want to accomplish.

**Workflows** (interface-first, existing pages): grouped in the sidebar under each surface (URLs stay under `workflows/`):

| Job                 | Doc                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| CI / health         | [Check run health](../workflows/check-run-health.md) (sidebar: **Interfaces → CLI → Workflows**)                                          |
| Find / explain      | [Find a model](../workflows/find-a-model.md), [Explain a failure](../workflows/explain-failure.md)                                        |
| Slow runs / browser | [Investigate slow runs](../workflows/investigate-slow-runs.md), [Open in web](../workflows/open-in-web.md) (sidebar: **Web → Workflows**) |
| Coding agent        | [Wire your coding agent](../workflows/wire-your-coding-agent.md) (sidebar: **Agents → Workflows**)                                        |

Full workflow index: [Workflows](../workflows/index.md).

## Next

- [5-minute quickstart](./quickstart.md) — run your first command
- [Choose by goal](./choose-by-goal.md) — route to the right interface for your job
- [Choose your interface](overview.md) — CLI, MCP, Web, or agent skills
- [Foundations: New to dbt?](./foundations/new-to-dbt.md) · [dbt artifacts & target/](../concepts/dbt-artifacts.md) — artifact literacy for dbt-tools
- [Trust & Safety](../trust/) — data boundaries, agent safety, and licensing
