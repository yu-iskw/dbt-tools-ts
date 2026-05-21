# @dbt-tools/web

**Artifact-driven investigation UI**: dependency graphs, execution timelines, inventory search, and health summaries from `manifest.json` and `run_results.json`—no LLM required.

## When to use the web UI

Use `dbt-tools-web` when you want a **browser** to explore lineage, critical path, bottlenecks, and inventory over a local `target/` directory or optional S3/GCS sources.

## Quick start

```bash
npx @dbt-tools/web --target ./target
```

Open the URL printed in the terminal (default port is shown in the CLI help).

Server-side credentials and optional startup flags are documented under [Configuration: Remote client flags](../reference/configuration.md#remote-client-flags). The **Load artifacts** panel can still set impersonation when configuring a GCS source in the UI.

## Learn more

- Package README: [`packages/web/README.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/web/README.md)
- [Troubleshooting](../reference/troubleshooting.md) — common setup issues
