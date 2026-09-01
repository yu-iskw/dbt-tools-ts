# Data boundaries

This page explains what files dbt-tools reads, what data may appear in its output, and what it does not access.

## What dbt-tools reads

dbt-tools reads dbt artifact files from the configured target root. It does not connect to your warehouse, dbt Cloud, or any external service unless you explicitly provide a remote target root.

| File                                 | Read by dbt-tools | Purpose                                                     |
| ------------------------------------ | ----------------- | ----------------------------------------------------------- |
| `manifest.json`                      | Yes               | Model definitions, test definitions, dependencies, metadata |
| `run_results.json`                   | Yes               | Execution status, timing, error messages                    |
| `catalog.json`                       | Yes (optional)    | Column-level type and description metadata                  |
| `sources.json`                       | Yes (optional)    | Source freshness results                                    |
| `semantic_manifest.json`             | No                | Not currently used                                          |
| Warehouse credentials                | No                | Never read by dbt-tools                                     |
| dbt profiles (`~/.dbt/profiles.yml`) | No                | Never read by dbt-tools                                     |
| dbt Cloud API                        | No                | Not accessed                                                |

## What may appear in output

CLI JSON output, Web UI views, and MCP tool responses may include any data that is present in the artifact files. This includes:

| Data type                      | Source                          | Example                                                     |
| ------------------------------ | ------------------------------- | ----------------------------------------------------------- |
| Model names and paths          | `manifest.json`                 | `model.my_project.fct_orders`, `models/core/fct_orders.sql` |
| Test names                     | `manifest.json`                 | `test.my_project.not_null_orders_id`                        |
| Column names and types         | `manifest.json`, `catalog.json` | `order_id`, `VARCHAR(256)`                                  |
| Model descriptions             | `manifest.json`                 | Free-text descriptions from `schema.yml`                    |
| Execution error messages       | `run_results.json`              | SQL errors, schema errors, assertion failures               |
| Execution timing               | `run_results.json`              | Start time, end time, duration                              |
| dbt version and schema version | Both                            | `1.8.0`, `v11`                                              |
| Project name and invocation ID | `manifest.json`                 | `my_project`, UUID                                          |
| Adapter type                   | `manifest.json`                 | `bigquery`, `snowflake`                                     |
| Generated timestamps           | Both                            | ISO 8601 timestamps                                         |
| Environment metadata           | `manifest.json`                 | Any `DBT_ENV_CUSTOM_ENV_*` variables set at dbt run time    |

## Environment metadata

dbt captures environment variables prefixed with `DBT_ENV_CUSTOM_ENV_` and stores them in `manifest.json` under the `metadata.env` field. These values appear in dbt-tools output.

**Do not set credentials, tokens, or secrets as `DBT_ENV_CUSTOM_ENV_*` variables.** If a secret is set this way, it will appear in `manifest.json` and in all dbt-tools output that reads the manifest.

## What dbt-tools does not access

- Your data warehouse (no SQL queries are issued)
- dbt Cloud (no API calls)
- Your dbt profiles or connections (`~/.dbt/profiles.yml`)
- Any files outside the configured target root directory or prefix
- The internet (unless `--dbt-target` points at a remote S3 or GCS prefix, which requires explicit configuration)

## Web UI data handling

The Web UI (`@dbt-tools/web`) is a server that runs locally. It reads artifacts from the configured target root and serves the browser UI from the same machine. The browser communicates only with the local server; it does not make external requests to third-party services.

If you deploy the Web UI to a remote server, the artifact data is accessible to anyone who can reach that server. Use appropriate network controls (firewall rules, authentication proxies) for remote deployments.

## MCP tool responses

The MCP server returns data from artifact files to the connected coding agent. The agent may include that data in its context window, summarize it, log it, or transmit it to third-party services depending on the agent's own configuration and privacy settings.

Review the privacy policy and data handling documentation of your coding agent before connecting it to production artifacts.

## Related

- [Agent safety](./agent-safety.md)
- [Production hardening](./production-hardening.md)
- [Try with a sample project](../guide/try-with-sample-project.md) — use public sample projects (e.g. jaffle_shop_duckdb) for public examples
