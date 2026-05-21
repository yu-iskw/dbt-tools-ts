# Getting started with @dbt-tools/web

**Artifact-driven investigation UI**: dependency graphs, execution timelines, inventory search, and health summaries from `manifest.json` and `run_results.json`—no LLM required.

Use `dbt-tools-web` when you want a **browser** to explore lineage, critical path, bottlenecks, and inventory over a local `target/` directory or remote **`s3://`** / **`gs://`** sources.

## Install and run

```bash
npx @dbt-tools/web --help
npx @dbt-tools/web --dbt-target ./target
```

**`--target ./target`** remains a shorthand for local directories (sets `DBT_TOOLS_TARGET_DIR`). For remote URIs, use **`--dbt-target`**.

```bash
# Remote GCS (credentials on the Node process, not in the browser)
npx @dbt-tools/web \
  --dbt-target gs://my-bucket/dbt/prod \
  --gcs-impersonate-service-account reader@project.iam.gserviceaccount.com
```

Open the URL printed in the terminal (default **127.0.0.1:3000** unless you pass `--port`).

## Learn more

- [Web server CLI](../../reference/web-cli.md) — full flag list (aligned with MCP)
- [Configuration](../../reference/configuration.md) — environment variables
- [Package README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/web/README.md)
- [Troubleshooting](../../reference/troubleshooting.md) — common setup issues
