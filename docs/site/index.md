---
layout: home
hero:
  name: dbt-tools
  image:
    src: /logo.svg
    alt: dbt-tools logo
  text: Debug, inspect, and automate dbt runs from artifacts
  tagline: Understand failures, slow models, lineage, and run health from manifest.json, run_results.json, and related dbt artifacts—without a chat surface.
  actions:
    - theme: brand
      text: Start in 5 minutes
      link: /guide/quickstart
    - theme: alt
      text: Choose by goal
      link: /guide/choose-by-goal
    - theme: alt
      text: Explore recipes
      link: /recipes/
    - theme: alt
      text: View on GitHub
      link: https://github.com/yu-iskw/dbt-tools-ts
features:
  - title: Analyze dbt artifacts
    details: Work with manifest.json, run_results.json, and related dbt outputs through structured TypeScript packages.
  - title: CLI, MCP, and Web
    details: Use dbt-tools from command-line workflows, long-lived MCP sessions, or a browser-based UI.
  - title: Built for automation
    details: Produce deterministic operational signals for engineering workflows and coding assistants.
---

<!-- markdownlint-disable MD041 -->

## What are you trying to do?

- **Debug a failed run** — Find failed nodes, error context, and downstream impact. Start with [Debug a failed run](recipes/debug-failed-run.md).
- **Investigate slow models** — Rank execution bottlenecks and inspect timing. Start with [Investigate slow models](recipes/investigate-slow-models.md).
- **Explore lineage in a browser** — Launch the Web UI for dependency and execution views. See [Web investigation tour](guide/web/investigation-tour.md).
- **Automate run-health checks in CI** — JSON summaries for scripts and pull requests. See [Check run health](workflows/check-run-health.md).
- **Connect a coding agent** — CLI, MCP, or agent skills over the same artifacts. See [Install agent skills](guide/agents/install.md).

## Interfaces

| Surface                             | Best for                              |
| ----------------------------------- | ------------------------------------- |
| [CLI](guide/cli/getting-started.md) | One-shot shell, CI, JSON automation   |
| [Web](guide/web/getting-started.md) | Browser investigation and timelines   |
| [MCP](guide/mcp/getting-started.md) | Long-lived agent sessions             |
| [Agent skills](guide/agents/)       | Cursor, Codex, Claude Code primitives |

Not sure which to pick? Use [Choose by goal](guide/choose-by-goal.md) or [Choose your interface](guide/overview.md).

## Packages

<!-- markdown-link-check-disable -->

- [@dbt-tools/cli](https://www.npmjs.com/package/@dbt-tools/cli) — `dbt-tools` for scripts, CI, and one-shot automation
- [@dbt-tools/mcp](https://www.npmjs.com/package/@dbt-tools/mcp) — `dbt-tools-mcp` for long-lived agent sessions
- [@dbt-tools/web](https://www.npmjs.com/package/@dbt-tools/web) — `dbt-tools-web` for browser-based investigation

<!-- markdown-link-check-enable -->
