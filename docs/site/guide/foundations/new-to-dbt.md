# New to dbt?

You have (or will soon have) `manifest.json` and `run_results.json` under a dbt `target/` directory, but you do not run dbt every day. This page routes you to the right dbt-tools docs without repeating the full artifact reference.

## What you need for dbt-tools

dbt-tools expects both files at the **root** of your `--dbt-target` path for a **full** session (`readiness: "full"` in `dbt-tools status --json` output):

- `manifest.json` — project graph, configs, and resource metadata
- `run_results.json` — per-node execution status and timing from a completed run

If you only have `manifest.json` (for example after `dbt compile`), many commands still work, but execution views need `run_results.json`. See [dbt artifacts & target/](../../concepts/dbt-artifacts.md) for when each file appears.

> **No dbt project yet?** Use [Try with a sample project](../try-with-sample-project.md) to generate artifacts with [jaffle_shop_duckdb](https://github.com/dbt-labs/jaffle_shop_duckdb), then point any quickstart or recipe command at `./target`.

## Read next

- [dbt artifacts & target/](../../concepts/dbt-artifacts.md) — main explainer: lifecycle, file roles, `unique_id`, discovery examples
- [5-minute quickstart](../quickstart.md) — first CLI commands against a target directory
- [Local and remote artifacts](../../concepts/local-and-remote-artifacts.md) — same contract for `s3://` and `gs://` prefixes

## Learn more from dbt Labs

These upstream docs are the authority for dbt features and artifact schemas. dbt-tools links to them instead of duplicating reference material.

| Topic                           | dbt Labs documentation                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| Artifact files                  | [dbt artifacts reference](https://docs.getdbt.com/reference/artifacts/dbt-artifacts)      |
| dbt Docs site vs JSON artifacts | [Build and view your docs](https://docs.getdbt.com/docs/explore/build-and-view-your-docs) |
| Nodes & selection               | [Node selection syntax](https://docs.getdbt.com/reference/node-selection/syntax)          |
| Sources & freshness             | [Sources](https://docs.getdbt.com/docs/build/sources)                                     |
