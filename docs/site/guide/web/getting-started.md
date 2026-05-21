# Getting started with @dbt-tools/web

**Artifact-driven investigation UI**: dependency graphs, execution timelines, inventory search, and health summaries from `manifest.json` and `run_results.json`—no LLM required.

Use `dbt-tools-web` when you want a **browser** to explore lineage, critical path, bottlenecks, and inventory over a local `target/` directory or optional S3/GCS sources.

## Install and run

```bash
npx @dbt-tools/web --target ./target
```

Open the URL printed in the terminal (default port is shown in the CLI help).

## Learn more

- [Configuration](../../reference/configuration.md) — environment variables and targets
- [Package README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/web/README.md)
- [Troubleshooting](../../reference/troubleshooting.md) — common setup issues
