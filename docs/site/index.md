---
layout: home
hero:
  name: dbt-tools
  image:
    src: /logo.svg
    alt: dbt-tools logo
  text: Debug, inspect, and automate dbt runs from artifacts
  tagline: Turn dbt manifests, run results, and metadata into deterministic insights for operators, automation, and agents.
  actions:
    - theme: brand
      text: Start in 5 minutes
      link: /guide/quickstart
    - theme: alt
      text: Choose by goal
      link: /guide/choose-by-goal
    - theme: alt
      text: View on GitHub
      link: https://github.com/yu-iskw/dbt-tools-ts
features:
  - title: Debug failed runs
    details: Identify failed models and tests, trace error context, and find the downstream blast radius—from the command line or a browser.
  - title: CLI, MCP, Web, and Agents
    details: One artifact contract, four surfaces. Use dbt-tools from shell scripts, long-lived agent sessions, a browser UI, or AI coding assistants.
  - title: Local, S3, and GCS artifacts
    details: Read manifest.json and run_results.json from a local target directory, an S3 prefix, or a GCS prefix with the same commands.
---

<!-- markdownlint-disable MD041 -->

## What are you trying to do?

- **[Debug a failed run](recipes/debug-failed-run.md)** — find failed nodes, error messages, and downstream impact
- **[Investigate slow models](recipes/investigate-slow-models.md)** — rank execution bottlenecks and inspect timing metadata
- **[Find model impact](recipes/find-model-impact.md)** — trace upstream and downstream dependencies before a change
- **[Generate a CI health summary](recipes/generate-ci-health-summary.md)** — produce deterministic JSON in GitHub Actions or CI
- **[Ask an AI agent about a dbt run](recipes/ask-agent-about-dbt-run.md)** — use MCP or agent skills safely

[See all recipes →](recipes/)

## Choose your interface

| Interface | Use when |
|---|---|
| **CLI** (`@dbt-tools/cli`) | Shell, CI, scripts, JSON output |
| **Web** (`@dbt-tools/web`) | Browser-based lineage and run investigation |
| **MCP** (`@dbt-tools/mcp`) | Long-lived AI agent sessions |
| **Agent skills** | Named operations for Cursor, Codex, Claude Code |

[Choose by goal →](guide/choose-by-goal.md) · [Ecosystem at a glance →](guide/ecosystem.md)

## Artifact sources

dbt-tools reads `manifest.json` and `run_results.json` from:

- A **local** `target/` directory — [local setup](deploy/local-target.md)
- An **S3** prefix — [S3 setup](deploy/s3.md)
- A **GCS** prefix — [GCS setup](deploy/gcs.md)
- **GitHub Actions** — [CI setup](deploy/github-actions.md)

## Trust & Safety

Before using production artifacts with agents or in shared environments: [Trust & Safety →](trust/)

## Packages

<!-- markdown-link-check-disable -->

- [@dbt-tools/cli](https://www.npmjs.com/package/@dbt-tools/cli) — `dbt-tools` for scripts, CI, and one-shot automation
- [@dbt-tools/mcp](https://www.npmjs.com/package/@dbt-tools/mcp) — `dbt-tools-mcp` for long-lived agent sessions
- [@dbt-tools/web](https://www.npmjs.com/package/@dbt-tools/web) — `dbt-tools-web` for browser-based investigation
- [@dbt-tools/core](https://www.npmjs.com/package/@dbt-tools/core) — TypeScript library for custom tooling

<!-- markdown-link-check-enable -->
