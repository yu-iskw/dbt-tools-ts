# Use artifacts from GCS

dbt-tools can read `manifest.json` and related artifacts directly from a Google Cloud Storage bucket. This is common when dbt runs in Dataproc, Cloud Composer, or other GCP-hosted pipelines that upload artifacts to GCS after a run.

## Minimal example

```bash
export DBT_TOOLS_GCS_PROJECT_ID=my-gcp-project
npx @dbt-tools/cli status \
  --dbt-target gs://my-bucket/dbt/prod/latest \
  --json
```

## Required objects

The GCS prefix must contain:

| Object key (relative to prefix) | Required |
|---|---|
| `manifest.json` | Yes |
| `run_results.json` | Yes (for run-related commands) |
| `catalog.json` | No |
| `sources.json` | No |

For example, if `--dbt-target` is `gs://my-bucket/dbt/prod/latest`, dbt-tools reads:

```
gs://my-bucket/dbt/prod/latest/manifest.json
gs://my-bucket/dbt/prod/latest/run_results.json
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DBT_TOOLS_GCS_PROJECT_ID` | Yes | GCP project ID used for billing and quota |
| `DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT` | No | Service account email to impersonate |

Standard GCP credential variables also apply: `GOOGLE_APPLICATION_CREDENTIALS` and `GOOGLE_CLOUD_PROJECT`. dbt-tools inherits the standard Google Cloud SDK credential chain (Application Default Credentials).

## With service account impersonation

Use impersonation to avoid embedding service account key files. The caller must have the `roles/iam.serviceAccountTokenCreator` role on the target service account:

```bash
export DBT_TOOLS_GCS_PROJECT_ID=my-gcp-project
export DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT=dbt-artifact-reader@my-project.iam.gserviceaccount.com
npx @dbt-tools/cli status \
  --dbt-target gs://my-bucket/dbt/prod/latest \
  --json
```

## With a service account key file

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
export DBT_TOOLS_GCS_PROJECT_ID=my-gcp-project
npx @dbt-tools/cli status \
  --dbt-target gs://my-bucket/dbt/prod/latest \
  --json
```

Prefer Workload Identity or impersonation over key files in production.

## Recommended IAM permissions

Grant the service account or user read-only access to the artifact prefix:

```
roles/storage.objectViewer
```

Scoped to the specific bucket or with a condition on the object prefix. Do not grant write permissions. dbt-tools only reads artifacts.

## Using in GitHub Actions with Workload Identity

```yaml
- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: projects/123456/locations/global/workloadIdentityPools/my-pool/providers/my-provider
    service_account: dbt-artifact-reader@my-project.iam.gserviceaccount.com

- name: Check dbt artifact health from GCS
  env:
    DBT_TOOLS_GCS_PROJECT_ID: my-gcp-project
  run: |
    npx @dbt-tools/cli status \
      --dbt-target gs://my-bucket/dbt/prod/latest \
      --json
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Object not found` | Object does not exist at the prefix | Confirm the prefix contains `manifest.json` |
| `403 Forbidden` | IAM policy missing `storage.objects.get` | Grant `roles/storage.objectViewer` to the caller |
| `Invalid project` | `DBT_TOOLS_GCS_PROJECT_ID` not set | Export the variable before running the command |
| Impersonation fails | Caller lacks `roles/iam.serviceAccountTokenCreator` | Grant the token creator role on the target service account |

## Related

- [S3](./s3.md) — Amazon S3
- [Credentials](./credentials.md) — credential precedence and least-privilege guidance
- [GitHub Actions](./github-actions.md) — full CI example
- [Configuration reference](../reference/configuration.md)
