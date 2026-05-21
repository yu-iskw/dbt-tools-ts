---
layout: home
hero:
  name: dbt-tools
  text: Operational intelligence for dbt artifacts
  tagline: Turn dbt manifests, run results, and metadata into deterministic insights for operators, automation, and agents.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/overview
    - theme: alt
      text: View on GitHub
      link: https://github.com/yu-iskw/dbt-tools-ts
features:
  - title: Analyze dbt artifacts
    details: Work with manifest.json, run_results.json, and related dbt outputs through structured TypeScript packages.
  - title: CLI, MCP, and Web
    details: Use dbt-tools from command-line workflows, long-lived MCP sessions, or a browser-based UI.
  - title: Built for automation
    details: Produce deterministic operational signals for engineering workflows and agent-friendly analysis.
---

<!-- markdownlint-disable MD041 -->

## Why dbt-tools?

dbt-tools helps operators and automation systems reason about dbt projects through structured artifact analysis.

## Pick your path

- [I run dbt in CI](guide/cli/getting-started.md) — one-shot CLI and JSON
- [I use AI in the IDE](guide/agents/install.md) — agent skills (Cursor, Codex, Claude)
- [I explore runs in the browser](guide/web/investigation-tour.md) — investigation UI
- [Follow a step-by-step workflow](guide/ecosystem.md) — job-oriented recipes

## Packages

- `@dbt-tools/cli` — `dbt-tools` for scripts, CI, and one-shot automation
- `@dbt-tools/mcp` — `dbt-tools-mcp` for long-lived agent sessions
- `@dbt-tools/web` — `dbt-tools-web` for browser-based investigation
