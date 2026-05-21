# @dbt-tools/cli

**Structured CLI** for dbt artifact analysis: machine-readable JSON, runtime `schema` introspection, `--fields` filtering, and stable exit codes for operators, CI, scripts, and coding agents.

## When to use the CLI

Use `dbt-tools` for **one-shot** analysis from the shell or CI. Each invocation loads artifacts for that command unless you reuse the same local target path.

## Quick start

```bash
npm install -g @dbt-tools/cli
dbt-tools summary --dbt-target ./target
```

Or without a global install:

```bash
npx @dbt-tools/cli status --dbt-target ./target
```

## Remote targets

For `s3://` or `gs://` prefixes and GCS impersonation, pass global remote flags **before** the subcommand. See [Configuration: Remote client flags](../reference/configuration.md#remote-client-flags).

```bash
dbt-tools \
  --gcs-impersonate-service-account svc@proj.iam.gserviceaccount.com \
  summary --dbt-target gs://my-bucket/dbt/prod/run --json
```

## Learn more

- Package README: [`packages/cli/README.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md)
- [Configuration](../reference/configuration.md) — environment variables and targets
