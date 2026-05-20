# Getting Started

dbt-tools provides TypeScript packages and command-line tools for analyzing dbt artifacts.

## Prerequisites

- A dbt project that has been run, producing artifacts such as `manifest.json` and `run_results.json`
- Node.js >=24.13.0

## Quick Start

Run tools directly against a dbt target directory using `npx`:

```bash
# Inspect model status from a dbt run
npx @dbt-tools/cli status --dbt-target ./target

# Start the MCP server for agent integration
npx @dbt-tools/mcp --dbt-target ./target

# Launch the browser UI
npx @dbt-tools/web --target ./target
```

## Next Steps

- Learn the CLI workflow in [CLI](./cli).
- Learn MCP usage in [MCP](./mcp).
- Explore the browser UI in [Web](./web).
- Understand what dbt artifacts contain in [dbt Artifacts](../concepts/dbt-artifacts).
