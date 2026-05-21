# Generate a CI health summary

## When to use this

Use this recipe in CI pipelines to produce a machine-readable dbt artifact health report. The output can gate deployments, annotate pull requests, or feed downstream monitoring tools.

## Inputs required

- `manifest.json` and `run_results.json` uploaded as CI artifacts or stored in object storage
- Node.js 20+ on the CI runner

## Recommended interface

| Interface | Use when                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| CLI       | Always — the CLI is designed for shell and CI usage with deterministic JSON output and reliable exit codes |
| MCP       | Not recommended for one-shot CI use; MCP is designed for long-lived agent sessions                         |
| Web       | Not applicable in CI; use the Web UI for local investigation                                               |

## Step 1: Run dbt and make artifacts available

Your CI pipeline must run dbt first and make the artifacts available to the dbt-tools step:

```yaml
- name: Run dbt
  run: dbt run --profiles-dir ./ --project-dir ./
```

After this step, `manifest.json` and `run_results.json` are under `./target/`.

## Step 2: Check artifact health

```bash
npx @dbt-tools/cli status --dbt-target ./target --json
```

Exit code 0 means the `status` command completed (files found or readable). It does **not** guarantee `readiness: "full"`—`manifest-only` after `dbt compile` also exits 0. When you need run results, gate on JSON:

```bash
test "$(npx @dbt-tools/cli status --dbt-target ./target --json | jq -r '.readiness')" = "full"
```

## Step 3: Generate a summary

```bash
npx @dbt-tools/cli summary --dbt-target ./target --json > dbt-tools-summary.json
```

The summary JSON includes node counts, error counts, and overall run status. Pipe it to `jq` or a PR comment script as needed.

## Full GitHub Actions example

```yaml
name: dbt artifact health
on:
  pull_request:
  push:
    branches: [main]

jobs:
  dbt-tools:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run dbt
        run: dbt run --profiles-dir ./ --project-dir ./

      - name: Check artifact health
        run: |
          npx @dbt-tools/cli status \
            --dbt-target ./target \
            --json > dbt-tools-status.json
          cat dbt-tools-status.json

      - name: Generate run summary
        run: |
          npx @dbt-tools/cli summary \
            --dbt-target ./target \
            --json > dbt-tools-summary.json
          cat dbt-tools-summary.json

      - name: Upload dbt-tools report
        uses: actions/upload-artifact@v4
        with:
          name: dbt-tools-report
          path: |
            dbt-tools-status.json
            dbt-tools-summary.json
```

## Using artifacts from object storage

If your dbt run uploads artifacts to S3 or GCS, point `--dbt-target` at the remote prefix instead of a local path:

```bash
npx @dbt-tools/cli status \
  --dbt-target s3://my-bucket/dbt/prod/latest \
  --json > dbt-tools-status.json
```

See [S3](../deploy/s3.md) and [GCS](../deploy/gcs.md) for credential setup.

## Exit code reference

| Exit code | Meaning                                                           |
| --------- | ----------------------------------------------------------------- |
| 0         | Command completed successfully                                    |
| 1         | Command failed (artifact missing, parse error, or node not found) |

Use `if [ $? -ne 0 ]; then ...` or GitHub Actions `if: failure()` steps to handle failures.

## Common failure modes

| Symptom                    | Likely cause                                   | Fix                                                                         |
| -------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| `readiness: unavailable`   | `--dbt-target` path does not contain artifacts | Confirm dbt ran before this step and produced output in `./target/`         |
| `readiness: manifest-only` | dbt command did not produce `run_results.json` | Use `dbt run`, `dbt test`, or `dbt build` rather than `dbt compile`         |
| Remote auth failure        | Missing cloud credentials                      | See [Credentials](../deploy/credentials.md)                                 |
| `npx` slow on cold runners | Package download time                          | Pin the package version or pre-install with `npm install -g @dbt-tools/cli` |

## Related

- [S3 artifacts](../deploy/s3.md)
- [GCS artifacts](../deploy/gcs.md)
- [GitHub Actions deploy guide](../deploy/github-actions.md)
- [CLI cheatsheet](../reference/cli-cheatsheet.md)
- [Configuration reference](../reference/configuration.md)
