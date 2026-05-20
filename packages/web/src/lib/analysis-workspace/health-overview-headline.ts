import { formatRunStartedAt, getInvocationTimestamp } from './utils';

import type { OverviewDerivedState } from './overview-state';
import type { AnalysisState, StatusTone } from '@web/types';

/** Headline + summary for Health posture (same rules as legacy overview banner). */
export function buildHealthOverviewHeadline(
  derived: OverviewDerivedState,
  filtered: boolean,
): { tone: StatusTone; title: string; summary: string } {
  if (derived.failingNodes > 0) {
    return {
      tone: 'danger',
      title: `${derived.failingNodes} failing node${derived.failingNodes === 1 ? '' : 's'} require attention`,
      summary: 'Prioritize failing nodes before reviewing downstream impact.',
    };
  }
  if (derived.warningNodes > 0) {
    return {
      tone: 'warning',
      title: `${derived.warningNodes} warning node${derived.warningNodes === 1 ? '' : 's'} need review`,
      summary: 'Warnings surfaced in this run. Review tests and runtime hotspots next.',
    };
  }
  return {
    tone: 'positive',
    title: 'Healthy run',
    summary: filtered
      ? 'No failing nodes match the current dashboard filters.'
      : 'No failing nodes surfaced in the latest run.',
  };
}

export function buildHealthSummaryBits(
  analysis: AnalysisState,
  projectName: string | null,
): string[] {
  const startedAt = getInvocationTimestamp(analysis);
  return [
    projectName ?? 'Workspace',
    `${analysis.graphSummary.totalNodes} graph nodes`,
    `${analysis.summary.total_nodes} executions`,
    analysis.invocationId != null ? `invocation ${analysis.invocationId}` : null,
    startedAt != null ? `invocation started ${formatRunStartedAt(startedAt)}` : null,
  ].filter((value): value is string => Boolean(value));
}
