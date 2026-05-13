import { buildAnalysisSnapshotFromArtifacts } from '@dbt-tools/core/browser';
import type { AnalysisState } from '@web/types';

export async function analyzeArtifacts(
  manifestJson: Record<string, unknown>,
  runResultsJson: Record<string, unknown>,
): Promise<AnalysisState> {
  return buildAnalysisSnapshotFromArtifacts(manifestJson, runResultsJson);
}
