# Choose by goal

Use this page to route to the right dbt-tools interface for your job. If you already know which package you need, go directly to its guide.

## Decision table

| Goal | Best interface | Why | Start here |
|---|---|---|---|
| Check whether a run succeeded | CLI | Fast, scriptable, JSON output | [Debug a failed run](../recipes/debug-failed-run.md) |
| Debug a failed model or test | CLI + Web | CLI summarizes; Web gives lineage context | [Debug a failed run](../recipes/debug-failed-run.md) |
| Investigate slow models | Web + CLI | Web for visual exploration; CLI for automation | [Investigate slow models](../recipes/investigate-slow-models.md) |
| Understand model impact | CLI + Web | Trace upstream and downstream dependencies | [Find model impact](../recipes/find-model-impact.md) |
| Automate checks in CI | CLI | Deterministic JSON output, reliable exit codes | [Generate CI health summary](../recipes/generate-ci-health-summary.md) |
| Move from CLI JSON to browser view | Web | Deep-link from JSON output directly to the UI | [Open CLI result in Web](../recipes/open-cli-result-in-web.md) |
| Let an AI assistant query artifacts | MCP | Long-lived server with resident parsed cache | [Ask an agent about a dbt run](../recipes/ask-agent-about-dbt-run.md) |
| Use agent skills in your IDE | Agent skills | Cursor, Codex, Claude Code primitive skills | [Install agent skills](./agents/install.md) |
| Build custom TypeScript tooling | Core | Programmatic API | [Core reference](../reference/core.md) |
| Read artifacts from object storage | CLI / Web / MCP | Shared `--dbt-target` config | [S3](../deploy/s3.md) or [GCS](../deploy/gcs.md) |

## Interface overview

**CLI (`@dbt-tools/cli`)** — `dbt-tools` binary. Use for one-shot shell commands, CI pipelines, and scripts that need JSON output. Starts and exits in one invocation. Exit codes signal success or failure.

**Web (`@dbt-tools/web`)** — `dbt-tools-web` binary. Starts a local server for browser-based investigation. Best for exploring lineage graphs, run timelines, and visual execution context.

**MCP (`@dbt-tools/mcp`)** — `dbt-tools-mcp` binary. Runs a long-lived Model Context Protocol server. An AI client connects and makes many tool calls against one parsed artifact session. Best when an agent needs to follow up multiple questions about the same run.

**Agent skills** — pre-built skills for Cursor, Codex, and Claude Code. Installed alongside the CLI or MCP package. Let agents invoke stable named operations without writing raw CLI commands.

**Core (`@dbt-tools/core`)** — TypeScript library. Import directly to build custom tools, scripts, or services on top of the same artifact parsing layer that CLI, Web, and MCP use.

## Prerequisites for all interfaces

- `manifest.json` and `run_results.json` under a dbt target directory
- Node.js 20+

Remote targets (`s3://`, `gs://`) require additional environment variables. See [Deploy](../deploy/).

## Related pages

- [5-minute quickstart](./quickstart.md) — get a first command running
- [Ecosystem at a glance](./ecosystem.md) — how CLI, MCP, Web, and Agents share one artifact contract
- [Trust & Safety](../trust/) — data boundaries, agent safety, and licensing
