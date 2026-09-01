# Credentials

dbt-tools uses standard cloud provider credential chains for remote artifact access. This page explains the precedence order and recommends least-privilege configuration for each provider.

## Local artifacts

Local target directories require no credentials. dbt-tools reads the filesystem directly using the permissions of the running process.

## Amazon S3 credential precedence

dbt-tools inherits the AWS SDK for JavaScript credential chain in this order:

1. Environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`
2. AWS shared credentials file (`~/.aws/credentials`)
3. AWS config file (`~/.aws/config`)
4. Named profile from `AWS_PROFILE`
5. IAM role attached to the execution environment (EC2 instance role, ECS task role, Lambda execution role)
6. Web Identity Token (Kubernetes service accounts, GitHub Actions OIDC)

### dbt-tools-specific S3 variables

| Variable                | Purpose                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `DBT_TOOLS_S3_REGION`   | AWS region of the bucket (recommended when the SDK needs it; falls back to `AWS_REGION`)    |
| `DBT_TOOLS_S3_ENDPOINT` | Custom S3-compatible endpoint URL (optional)                                                |

### Least-privilege S3 policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::my-bucket", "arn:aws:s3:::my-bucket/dbt/prod/latest/*"]
    }
  ]
}
```

Grant only `s3:GetObject` and `s3:ListBucket` on the artifact prefix. Do not grant write permissions.

## Google Cloud Storage credential precedence

dbt-tools inherits the Google Cloud SDK Application Default Credentials (ADC) chain in this order:

1. `GOOGLE_APPLICATION_CREDENTIALS` — path to a service account key file
2. gcloud CLI user credentials (`gcloud auth application-default login`)
3. Attached service account (Compute Engine, Cloud Run, GKE Workload Identity)
4. Service account impersonation via `DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT`

### dbt-tools-specific GCS variables

| Variable                                    | Purpose                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `DBT_TOOLS_GCS_PROJECT_ID`                  | GCP project ID for the GCS client (recommended when the SDK cannot infer it from ADC / env)      |
| `DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT` | Service account email to impersonate (optional)                                                  |

### Least-privilege GCS IAM

Assign `roles/storage.objectViewer` to the service account or workload identity, scoped to the artifact bucket or prefix. Do not grant `roles/storage.objectAdmin` or write roles.

For impersonation, grant the caller `roles/iam.serviceAccountTokenCreator` on the target service account.

## General recommendations

**Prefer short-lived credentials.** Use IAM roles, Workload Identity, or OIDC token exchange rather than long-lived access keys or service account key files.

**Scope access to the artifact prefix.** Do not grant bucket-level or project-level read access when a prefix-scoped policy is sufficient.

**Do not embed credentials in artifacts.** dbt allows setting environment metadata via `DBT_ENV_CUSTOM_ENV_*` variables. Avoid putting credentials or secrets in these fields, as they appear in `manifest.json`.

**Rotate keys if used.** If you must use access keys or key files, rotate them on a schedule and store them in a secrets manager, not in plain text files or environment configurations.

**Audit access logs.** Enable S3 server access logs or GCS audit logs on artifact buckets to detect unexpected access patterns.

## Related

- [S3](./s3.md)
- [GCS](./gcs.md)
- [GitHub Actions](./github-actions.md)
- [Production hardening](../trust/production-hardening.md)
- [Configuration reference](../reference/configuration.md)
