# Investigation tour

`dbt-tools-web` is a **browser UI** for exploring dbt artifacts—no LLM required. It reads `manifest.json` and `run_results.json` from a local `target/` directory or preloads **`s3://`** / **`gs://`** roots when you pass **`--dbt-target`** at startup (same flags as MCP for GCS impersonation and S3 client settings).

## Start the UI

```bash
npx @dbt-tools/web --dbt-target ./target
# or local alias:
npx @dbt-tools/web --target ./target
```

Open the URL printed in the terminal. See [Web server CLI](../../reference/web-cli.md) for remote and impersonation examples.

## What to explore

| Area                   | What you get                                           |
| ---------------------- | ------------------------------------------------------ |
| **Discover**           | Ranked resource search aligned with CLI `discover`     |
| **Lineage**            | Dependency graph for a selected resource               |
| **Execution**          | Timelines, durations, and bottlenecks from run results |
| **Health / inventory** | Run readiness and resource lists                       |

## Typical flow

1. Confirm artifacts with [Check run health](../../workflows/check-run-health.md).
2. Start the web server and open discover to find a model.
3. Drill into lineage and execution for that resource.
4. Use CLI `query-executions` when you need a scriptable top-N list from the same run.

## Learn more

- [Getting started](./getting-started.md)
- [Investigate slow runs](../../workflows/investigate-slow-runs.md)
- [Troubleshooting](../../reference/troubleshooting.md)
- [Web README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/web/README.md)
