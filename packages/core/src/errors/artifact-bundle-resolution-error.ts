export type DbtArtifactBundleProvider = 'gcs' | 'local' | 's3';

const REMOTE_HINT =
  'Remote: use s3://bucket/prefix or gs://bucket/prefix; set cloud credentials and optional DBT_TOOLS_GCS_* / DBT_TOOLS_S3_* (region, endpoint, projectId, impersonation).';

const LOCAL_HINT =
  'Local: pass a directory that contains manifest.json and run_results.json (catalog.json and sources.json are optional).';

/**
 * Thrown when fixed-name dbt artifacts cannot be resolved under a `--dbt-target`.
 */
export class ArtifactBundleResolutionError extends Error {
  override readonly name = 'ArtifactBundleResolutionError';

  constructor(
    message: string,
    public readonly target: string,
    public readonly provider: DbtArtifactBundleProvider,
    public readonly missing: string[],
    public readonly found: string[],
    public readonly keysTried?: string[],
  ) {
    super(message);
  }

  static incomplete(args: {
    target: string;
    provider: DbtArtifactBundleProvider;
    missing: string[];
    found: string[];
    keysTried?: string[];
    required?: string[];
  }): ArtifactBundleResolutionError {
    const { target, provider, missing, found, keysTried } = args;
    const required = args.required ?? ['manifest.json', 'run_results.json'];
    const lines: string[] = [
      `Missing required dbt artifact files under this target (${provider}): ${target}`,
      '',
      'Status:',
    ];
    for (const f of required) {
      const ok = found.includes(f);
      lines.push(`  ${ok ? '[ok]' : '[missing]'} ${f}`);
    }
    const optional = ['catalog.json', 'sources.json'] as const;
    for (const f of optional) {
      if (found.includes(f)) {
        lines.push(`  [ok] ${f} (optional)`);
      }
    }
    lines.push('', `Missing: ${missing.join(', ') || '(none)'}`);
    lines.push(`Found: ${found.join(', ') || '(none)'}`);
    if (keysTried != null && keysTried.length > 0) {
      lines.push('', 'Object keys checked:');
      for (const k of keysTried) {
        lines.push(`  - ${k}`);
      }
    }
    lines.push('', provider === 'local' ? LOCAL_HINT : REMOTE_HINT);
    return new ArtifactBundleResolutionError(
      lines.join('\n'),
      target,
      provider,
      missing,
      found,
      keysTried,
    );
  }
}
