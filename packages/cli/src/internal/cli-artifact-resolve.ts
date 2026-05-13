import {
  getDbtToolsDbtTargetFromEnv,
  type DbtArtifactBundleRequirements,
  resolveDbtToolsArtifactBundlePaths,
  type ArtifactPaths,
} from '@dbt-tools/core';

const MISSING_TARGET_MSG =
  'Pass --dbt-target <path|s3://bucket/prefix|gs://bucket/prefix> or set DBT_TOOLS_DBT_TARGET in the environment.';

export type ArtifactRootCliOptions = {
  dbtTarget?: string;
};

/**
 * Effective `--dbt-target`: explicit flag wins, then `DBT_TOOLS_DBT_TARGET`.
 */
export function resolveEffectiveDbtTarget(flag?: string): string {
  const fromFlag = flag?.trim();
  if (fromFlag != null && fromFlag !== '') {
    return fromFlag;
  }
  const fromEnv = getDbtToolsDbtTargetFromEnv()?.trim();
  if (fromEnv != null && fromEnv !== '') {
    return fromEnv;
  }
  throw new Error(`dbt artifact target is required. ${MISSING_TARGET_MSG}`);
}

/**
 * Resolve manifest / run_results / optional catalog + sources from `--dbt-target`.
 */
export async function resolveCliArtifactPaths(
  roots: ArtifactRootCliOptions,
  requirements?: DbtArtifactBundleRequirements,
): Promise<ArtifactPaths> {
  const raw = resolveEffectiveDbtTarget(roots.dbtTarget);
  return resolveDbtToolsArtifactBundlePaths({
    dbtTargetRaw: raw,
    requirements,
  });
}
