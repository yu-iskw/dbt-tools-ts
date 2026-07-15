# Production hardening

This page covers configuration practices for running dbt-tools in production environments, including CI/CD pipelines, shared infrastructure, and scheduled artifact analysis.

## Credential hygiene

**Use short-lived credentials.** Prefer IAM roles, Workload Identity Federation, or OIDC token exchange over long-lived access keys or service account key files. Short-lived credentials limit blast radius if exposed.

**Scope credentials to the artifact prefix.** Grant read-only access to the specific S3 prefix or GCS path where dbt artifacts are stored. Do not grant bucket-level or project-level access when prefix-level access is sufficient.

**Rotate any long-lived keys.** If you must use access keys or key files, rotate them on a schedule and store them in a secrets manager. Never commit them to source control.

**Do not expose credentials via dbt env metadata.** Variables set as `DBT_ENV_CUSTOM_ENV_*` appear in `manifest.json`. Avoid using this mechanism to pass tokens, passwords, or connection strings.

See [Credentials](../deploy/credentials.md) for provider-specific guidance.

## Artifact hygiene

**Use separate artifact roots for dev and prod.** Do not point production analysis tools at development runs, and do not expose production artifacts in development workflows.

**Do not commit real artifacts to source control.** `manifest.json` and `run_results.json` may contain project metadata, column names, and error messages. Use `.gitignore` to exclude `target/` from version control.

**Use sample-project artifacts for demos.** Never use real production artifacts for screenshots, blog posts, or documentation examples. Use a [public sample project](../guide/try-with-sample-project.md) (e.g. jaffle_shop_duckdb).

**Clean up old artifact copies.** If you archive artifacts to S3 or GCS, apply a lifecycle policy to delete old prefixes after a retention period.

## CI/CD practices

**Pin the dbt-tools version.** In CI, use a pinned version of `@dbt-tools/cli` rather than `latest` to avoid unexpected behavior from version updates:

```bash
npx @dbt-tools/cli@1.2.3 status --dbt-target ./target --json
```

Or pre-install a pinned version:

```yaml
- run: npm install -g @dbt-tools/cli@1.2.3
```

**Store CI secrets as encrypted variables.** AWS or GCP credentials used for remote artifact access should be stored as repository secrets or a secrets manager entry, not as plain-text environment variables in workflow files.

**Fail fast on unavailable artifacts.** Gate subsequent CI steps on the exit code of `dbt-tools status`. If artifacts are missing, fail early rather than proceeding with stale or partial data.

**Log output for audit.** Capture `dbt-tools status` and `dbt-tools summary` output as CI artifacts. This creates a record of what was seen at each run without exposing it further.

## Node.js permission model (defense in depth)

dbt-tools does **not** re-exec published binaries under Node's [permission model](https://nodejs.org/api/permissions.html) by default — that would surprise operators who expect normal filesystem access for `--dbt-target`.

For defense in depth after a compromised dependency, you can run CLI or MCP invocations under explicit read scope (Node 20.5+):

```bash
node --permission --allow-fs-read="$(realpath ./target)" \
  ./node_modules/.bin/dbt-tools status --dbt-target ./target --json
```

Grant only the artifact root (or parent directory) the process needs. Omit `--allow-fs-write` unless you use `export --out` to a known path, then add a single `--allow-fs-write` for that output directory.

**CI smoke recommendation:** add an optional job that runs `status` or `check-session` against a fixture target under `--permission --allow-fs-read=<fixture-dir>` to verify the binary still works when filesystem access is constrained. This is a smoke check, not a substitute for credential scoping or network controls.

## Network controls for the Web UI

The Web UI (`@dbt-tools/web`) binds to `localhost` by default. If you expose it on a network interface reachable by others:

- Use an authentication proxy (OAuth, HTTP Basic, mTLS) in front of it
- Restrict access at the network layer (firewall rules, VPN, private network)
- Do not expose the Web UI to the public internet without access controls

If the Web UI is only used for local development and investigation, no additional network controls are needed.

## Secrets scanning

If dbt runs set `DBT_ENV_CUSTOM_ENV_*` variables, periodically inspect `manifest.json` to confirm no secrets appear in the `metadata.env` field:

```bash
cat target/manifest.json | jq '.metadata.env'
```

If this field contains tokens or passwords, remove them from the dbt run configuration immediately.

## Related

- [Credentials](../deploy/credentials.md)
- [Data boundaries](./data-boundaries.md)
- [Agent safety](./agent-safety.md)
- [S3](../deploy/s3.md)
- [GCS](../deploy/gcs.md)
