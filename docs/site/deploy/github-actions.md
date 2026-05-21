# Use dbt-tools in GitHub Actions

This page shows how to run dbt-tools in GitHub Actions workflows to produce artifact health reports and enforce CI gates.

## Minimal example: check artifact health

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
            --json

      - name: Generate run summary
        run: |
          npx @dbt-tools/cli summary \
            --dbt-target ./target \
            --json > dbt-tools-summary.json

      - uses: actions/upload-artifact@v4
        with:
          name: dbt-tools-summary
          path: dbt-tools-summary.json
```

## Gate on artifact health

Use the exit code from `status` to gate subsequent steps:

```yaml
- name: Check artifact health
  run: npx @dbt-tools/cli status --dbt-target ./target --json
  # Non-zero exit code fails the step; subsequent steps are skipped
```

## Read artifacts from S3

If your dbt run uploads artifacts to S3:

```yaml
- name: Check artifact health from S3
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    DBT_TOOLS_S3_REGION: us-east-1
  run: |
    npx @dbt-tools/cli status \
      --dbt-target s3://my-bucket/dbt/prod/latest \
      --json
```

See [S3](./s3.md) for credential setup details.

## Read artifacts from GCS

```yaml
- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
    service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}

- name: Check artifact health from GCS
  env:
    DBT_TOOLS_GCS_PROJECT_ID: my-gcp-project
  run: |
    npx @dbt-tools/cli status \
      --dbt-target gs://my-bucket/dbt/prod/latest \
      --json
```

See [GCS](./gcs.md) for credential setup details.

## Use dbt-tools output in a PR comment

Capture the JSON output and post it as a PR comment using the GitHub CLI.

`--json` produces pretty-printed multiline JSON, so use the GitHub Actions heredoc delimiter syntax for step outputs instead of `name=value`:

```yaml
- name: Generate summary
  id: summary
  run: |
    OUTPUT=$(npx @dbt-tools/cli summary --dbt-target ./target --json)
    {
      echo "summary<<EOF"
      echo "$OUTPUT"
      echo "EOF"
    } >> "$GITHUB_OUTPUT"

- name: Comment on PR
  if: github.event_name == 'pull_request'
  env:
    GH_TOKEN: ${{ github.token }}
  run: |
    gh pr comment ${{ github.event.pull_request.number }} \
      --body "dbt-tools summary: ${{ steps.summary.outputs.summary }}"
```

> The `name<<EOF` / `EOF` delimiter form is required whenever the value contains newlines. Using `echo "name=$VALUE" >> $GITHUB_OUTPUT` with multiline JSON will silently produce a malformed output file and cause downstream step failures.

## Cache npx downloads between runs

Caching the npm package download reduces cold-start time:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'

- name: Install dbt-tools
  run: npm install -g @dbt-tools/cli

- name: Check artifact health
  run: dbt-tools status --dbt-target ./target --json
```

## Troubleshooting

| Symptom                         | Likely cause                                   | Fix                                                             |
| ------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| `status: unavailable`           | dbt did not produce artifacts before this step | Confirm dbt ran and `./target/manifest.json` exists             |
| `npx` fails on private registry | Registry not configured                        | Set `NODE_AUTH_TOKEN` and `NPM_REGISTRY` for private registries |
| Remote auth error               | Secrets not passed to the step                 | Check that the secrets are available in the job's `env` block   |

## Related

- [S3](./s3.md)
- [GCS](./gcs.md)
- [Credentials](./credentials.md)
- [Generate CI health summary](../recipes/generate-ci-health-summary.md) — full recipe with output capture
- [Configuration reference](../reference/configuration.md)
