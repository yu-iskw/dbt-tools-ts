import { useMemo } from 'react';

import { runNodeAction } from '@web/lib/analysis-workspace/node-actions';
import { buildRunBrief } from '@web/lib/analysis-workspace/run-brief';

import type { NodeNavigate } from '@web/lib/analysis-workspace/node-actions';
import type { BriefAction, BriefSegment } from '@web/lib/analysis-workspace/run-brief';
import type { AnalysisState } from '@web/types';
import type { ReactElement } from 'react';

function actionTitle(action: BriefAction): string {
  return action.kind === 'runs' ? 'Show in Runs' : 'Open in Timeline';
}

function runAction(action: BriefAction, onNavigateTo: NodeNavigate): void {
  if (action.kind === 'runs') {
    onNavigateTo('runs', { runsStatus: action.status });
  } else {
    runNodeAction('timeline', action.nodeId, onNavigateTo);
  }
}

function BriefSegmentView({
  segment,
  onNavigateTo,
}: {
  segment: BriefSegment;
  onNavigateTo: NodeNavigate;
}): ReactElement {
  const { action, text } = segment;
  if (action == null) return <>{text}</>;
  return (
    <button
      type="button"
      className="run-brief__link"
      title={actionTitle(action)}
      onClick={() => runAction(action, onNavigateTo)}
    >
      {text}
    </button>
  );
}

/** The whole run in a few plain sentences, each key phrase linking to its evidence. */
export function RunBrief({
  analysis,
  onNavigateTo,
}: {
  analysis: AnalysisState;
  onNavigateTo: NodeNavigate;
}): ReactElement | null {
  const { executions, adapterTotals } = analysis;
  const lines = useMemo(
    () => buildRunBrief({ executions, adapterTotals }),
    [executions, adapterTotals],
  );
  if (lines.length === 0) return null;

  return (
    <ul className="run-brief" aria-label="Run brief">
      {lines.map((line) => (
        <li key={line.id}>
          {line.segments.map((segment, index) => (
            <BriefSegmentView
              key={`${line.id}-${index}`}
              segment={segment}
              onNavigateTo={onNavigateTo}
            />
          ))}
        </li>
      ))}
    </ul>
  );
}
