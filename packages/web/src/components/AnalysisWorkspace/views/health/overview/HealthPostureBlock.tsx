import type { AnalysisState } from '@web/types';
import type { OverviewDerivedState } from '@web/lib/analysis-workspace/overviewState';
import {
  buildHealthOverviewHeadline,
  buildHealthSummaryBits,
} from '@web/lib/analysis-workspace/healthOverviewHeadline';
import { formatSeconds } from '@web/lib/analysis-workspace/utils';
import { sourceBadgeLabel } from '@web/lib/artifactSource';
import type { WorkspaceArtifactSource } from '@web/services/artifactSourceApi';
import type { WorkspaceSignal } from '@web/lib/analysis-workspace/types';

function workspaceModeFromSignals(signals: WorkspaceSignal[]): string {
  const mode = signals.find((s) => s.label === 'Workspace mode');
  return mode?.value ?? '—';
}

export function HealthPostureBlock({
  analysis,
  projectName,
  analysisSource,
  derived,
  filtered,
  workspaceSignals,
}: {
  analysis: AnalysisState;
  projectName: string | null;
  analysisSource: WorkspaceArtifactSource | null;
  derived: OverviewDerivedState;
  filtered: boolean;
  workspaceSignals: WorkspaceSignal[];
}) {
  const { tone, title, summary } = buildHealthOverviewHeadline(derived, filtered);
  const summaryBits = buildHealthSummaryBits(analysis, projectName);
  const runtime = filtered
    ? formatSeconds(derived.filteredExecutionTime)
    : formatSeconds(analysis.summary.total_execution_time);
  const sourceLabel = sourceBadgeLabel(analysisSource);
  const modeLabel = workspaceModeFromSignals(workspaceSignals);

  const followup =
    derived.failingNodes > 0
      ? `${derived.failedModels} failed model${derived.failedModels === 1 ? '' : 's'} may block downstream investigation.`
      : derived.warningNodes > 0
        ? 'Review tests and runtime hotspots next.'
        : null;

  return (
    <section className={`health-posture health-posture--${tone}`} aria-label="Run posture">
      <div className="health-posture__top">
        <p className="eyebrow">Run posture</p>
        <span className="health-posture__source">{sourceLabel}</span>
      </div>
      <p className="health-posture__meta">{summaryBits.join(' · ')}</p>
      <h3 className="health-posture__headline">{title}</h3>
      <p className="health-posture__summary">{summary}</p>
      {followup != null && <p className="health-posture__followup">{followup}</p>}
      <div className="health-posture__metrics" role="list">
        <div className="health-posture__metric" role="listitem">
          <span>Failing</span>
          <strong>{derived.failingNodes}</strong>
        </div>
        <div className="health-posture__metric" role="listitem">
          <span>Warnings</span>
          <strong>{derived.warningNodes}</strong>
        </div>
        <div className="health-posture__metric" role="listitem">
          <span>Runtime</span>
          <strong>{runtime}</strong>
        </div>
        <div className="health-posture__metric" role="listitem">
          <span>Workspace</span>
          <strong>{modeLabel}</strong>
        </div>
      </div>
    </section>
  );
}
