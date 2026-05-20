export class ArtifactTargetNotConfiguredError extends Error {
  override readonly name = 'ArtifactTargetNotConfiguredError';

  static readonly message = 'dbt artifact target is not configured.';
  static readonly hint =
    'Configure a dbt artifact root (local path or s3:// / gs:// URI) before loading artifacts.';

  readonly hint = ArtifactTargetNotConfiguredError.hint;

  constructor(message = ArtifactTargetNotConfiguredError.message) {
    super(message);
  }
}
