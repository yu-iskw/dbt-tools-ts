import type { WorkspaceSignal } from '@web/lib/analysis-workspace/types';
import type { WorkspaceArtifactSource } from '@web/services/artifact-source-api';
import type { AnalysisState } from '@web/types';

function workspaceModeSignal(
  analysis: AnalysisState,
  analysisSource: WorkspaceArtifactSource | null,
  totalTests: number,
) {
  if (analysisSource === 'preload') {
    return {
      value: 'Live target',
      detail: `Synced from DBT_TOOLS_TARGET_DIR with ${analysis.graphSummary.totalEdges} dependency edges ready for investigation.`,
    };
  }

  if (analysisSource === 'remote') {
    return {
      value: 'Remote source',
      detail: `Managed from remote object storage with ${analysis.graphSummary.totalEdges} dependency edges ready for investigation.`,
    };
  }

  return {
    value: 'Artifact upload',
    detail: `${analysis.summary.total_nodes} executions loaded from local artifacts${totalTests > 0 ? `, including ${totalTests} tests` : ''}.`,
  };
}

export function buildWorkspaceSignals(
  analysis: AnalysisState,
  analysisSource: WorkspaceArtifactSource | null,
): WorkspaceSignal[] {
  const attentionCount = analysis.executions.filter((row) => row.statusTone === 'danger').length;
  const warningCount = analysis.executions.filter((row) => row.statusTone === 'warning').length;
  const totalTests = analysis.executions.filter((row) =>
    ['test', 'unit_test'].includes(row.resourceType),
  ).length;
  const documentedResources = analysis.resources.filter((resource) =>
    Boolean(resource.description?.trim()),
  ).length;
  const documentationCoverage =
    analysis.resources.length > 0
      ? Math.round((documentedResources / analysis.resources.length) * 100)
      : 0;
  const modeSignal = workspaceModeSignal(analysis, analysisSource, totalTests);

  return [
    {
      label: 'Run posture',
      value:
        attentionCount > 0
          ? `${attentionCount} failing`
          : warningCount > 0
            ? `${warningCount} warning`
            : 'Healthy',
      detail:
        attentionCount > 0
          ? 'Prioritize failing nodes before reviewing downstream impact.'
          : warningCount > 0
            ? 'Warnings detected; review tests and exposures next.'
            : 'No failing nodes surfaced in this run.',
      tone: attentionCount > 0 ? 'danger' : warningCount > 0 ? 'warning' : 'positive',
    },
    {
      label: 'Metadata coverage',
      value: `${documentationCoverage}%`,
      detail: `${documentedResources} of ${analysis.resources.length} resources include descriptions for catalog-style discovery.`,
      tone:
        documentationCoverage >= 70
          ? 'positive'
          : documentationCoverage >= 35
            ? 'warning'
            : 'neutral',
    },
    {
      label: 'Workspace mode',
      value: modeSignal.value,
      detail: modeSignal.detail,
      tone: 'neutral',
    },
  ] as const;
}
