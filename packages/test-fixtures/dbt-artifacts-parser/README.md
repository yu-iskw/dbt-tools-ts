# dbt artifact test fixtures

Golden JSON under `resources/` is produced by running dbt against
[jaffle_shop_duckdb](https://github.com/dbt-labs/jaffle_shop_duckdb). Do not
hand-edit `metadata.dbt_version` or invent artifact bodies.

Layout:

- Schema version is the folder (`manifest/v12`, `run_results/v6`, `catalog/v1`).
- dbt Core minor is the filename suffix when several minors share a schema
  (`manifest_1.12.json`).

## Regenerate

From the repository root:

```bash
bash scripts/generate-jaffle-fixtures.sh 1.12.3
```

The script clones jaffle_shop_duckdb, creates a Python virtualenv (`python3 -m venv`, or `python3 -m virtualenv` when `ensurepip` is missing), installs the pinned `dbt-core` plus `dbt-duckdb`, runs `dbt build` and `dbt docs generate`, then copies `target/manifest.json`, `run_results.json`, and `catalog.json` into this tree.

Override the Core pin with the first argument or `DBT_CORE_VERSION`. Default is
`1.12.3`.
