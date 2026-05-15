import {
  normalizeGcsAuthOverrides,
  resolveDbtToolsDbtTargetFromFlagOrEnv,
  type DbtArtifactBundleRequirements,
  resolveDbtToolsArtifactBundlePaths,
  type ArtifactPaths,
} from '@dbt-tools/core';

export type ArtifactRootCliOptions = {
  dbtTarget?: string;
  gcsProjectId?: string;
  gcsImpersonateServiceAccount?: string;
};

/**
 * Subset of CLI options used for artifact path resolution (pass through from action handlers).
 */
export function extractArtifactRootCliOptions(o: ArtifactRootCliOptions): ArtifactRootCliOptions {
  const { dbtTarget, gcsProjectId, gcsImpersonateServiceAccount } = o;
  return { dbtTarget, gcsProjectId, gcsImpersonateServiceAccount };
}

/**
 * Effective `--dbt-target`: explicit flag wins, then `DBT_TOOLS_DBT_TARGET`.
 */
export function resolveEffectiveDbtTarget(flag?: string): string {
  return resolveDbtToolsDbtTargetFromFlagOrEnv(flag);
}

/**
 * Resolve manifest / run_results / optional catalog + sources from `--dbt-target`.
 */
export async function resolveCliArtifactPaths(
  roots: ArtifactRootCliOptions,
  requirements?: DbtArtifactBundleRequirements,
): Promise<ArtifactPaths> {
  const raw = resolveEffectiveDbtTarget(roots.dbtTarget);
  const gcsAuthOverrides = normalizeGcsAuthOverrides({
    projectId: roots.gcsProjectId,
    impersonateServiceAccount: roots.gcsImpersonateServiceAccount,
  });
  return resolveDbtToolsArtifactBundlePaths({
    dbtTargetRaw: raw,
    requirements,
    ...(gcsAuthOverrides !== undefined ? { gcsAuthOverrides } : {}),
  });
}
