---
layout: home
hero:
  name: dbt-tools
  text: Operational intelligence for dbt artifacts
  tagline: Turn dbt manifests, run results, and metadata into deterministic insights for operators, automation, and agents.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
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

## Why dbt-tools?

dbt-tools helps operators and automation systems reason about dbt projects through structured artifact analysis.

## Packages

- `@dbt-tools/core` — shared parsing and analysis logic
- `@dbt-tools/cli` — command-line interface for querying dbt artifacts
- `@dbt-tools/mcp` — Model Context Protocol server for agent integrations
- `@dbt-tools/web` — browser-based UI for exploring dbt artifacts
