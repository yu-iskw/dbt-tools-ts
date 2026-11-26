import {
  buildHealthOverviewHeadline,
  buildHealthSummaryBits,
} from '@web/lib/analysis-workspace/health-overview-headline';
import { formatSeconds } from '@web/lib/analysis-workspace/utils';
import { sourceBadgeLabel } from '@web/lib/artifact-source';

import { RunBrief } from './RunBrief';

import type { OverviewDerivedState } from '@web/lib/analysis-workspace/overview-state';
import type { AnalysisWorkspaceProps, WorkspaceSignal } from '@web/lib/analysis-workspace/types';
import type { WorkspaceArtifactSource } from '@web/services/artifact-source-api';
import type { AnalysisState } from '@web/types';
import type { ReactElement } from 'react';

function workspaceModeFromSignals(signals: WorkspaceSignal[]): string {
  const mode = signals.find((s) => s.label === 'Workspace mode');
  return mode?.value ?? '—';
}

function PostureMetric({
  label,
  value,
  onSelect,
}: {
  label: string;
  value: number;
  onSelect: () => void;
}): ReactElement {
  return (
    <div className="health-posture__metric" role="listitem">
      {value > 0 ? (
        <button
          type="button"
          className="health-posture__metric-link"
          aria-label={`${label}: ${value}. Show in Runs`}
          onClick={onSelect}
        >
          <span>{label}</span>
          <strong>{value}</strong>
        </button>
      ) : (
        <>
          <span>{label}</span>
          <strong>{value}</strong>
        </>
      )}
    </div>
  );
}

export function HealthPostureBlock({
  analysis,
  projectName,
  analysisSource,
  derived,
  filtered,
  workspaceSignals,
  onNavigateTo,
}: {
  analysis: AnalysisState;
  projectName: string | null;
  analysisSource: WorkspaceArtifactSource | null;
  derived: OverviewDerivedState;
  filtered: boolean;
  workspaceSignals: WorkspaceSignal[];
  onNavigateTo: AnalysisWorkspaceProps['onNavigateTo'];
}): ReactElement {
  const { tone, title, summary } = buildHealthOverviewHeadline(derived, filtered);
  const summaryBits = buildHealthSummaryBits(analysis, projectName);
  const nodeTime = filtered
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
      {filtered ? (
        <>
          <p className="health-posture__summary">{summary}</p>
          {followup != null && <p className="health-posture__followup">{followup}</p>}
        </>
      ) : (
        <RunBrief analysis={analysis} onNavigateTo={onNavigateTo} />
      )}
      <div className="health-posture__metrics" role="list">
        <PostureMetric
          label="Failing"
          value={derived.failingNodes}
          onSelect={() => onNavigateTo('runs', { runsStatus: 'danger' })}
        />
        <PostureMetric
          label="Warnings"
          value={derived.warningNodes}
          onSelect={() => onNavigateTo('runs', { runsStatus: 'warning' })}
        />
        <div
          className="health-posture__metric"
          role="listitem"
          title="Sum of every node's execution time. This is not the run's wall-clock time."
        >
          <span>Node time</span>
          <strong>{nodeTime}</strong>
        </div>
        <div className="health-posture__metric" role="listitem">
          <span>Workspace</span>
          <strong>{modeLabel}</strong>
        </div>
      </div>
    </section>
  );
}
