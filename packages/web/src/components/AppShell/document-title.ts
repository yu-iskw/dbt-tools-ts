import { navigationItems } from './app-navigation';
import { countRunIssues } from './workspace-signals';

import type { WorkspaceView } from '@web/lib/analysis-workspace/types';
import type { AnalysisState } from '@web/types';

const BASE_TITLE = 'dbt-tools';

function viewLabel(activeView: WorkspaceView): string {
  if (activeView === 'settings') return 'Settings';
  return navigationItems.find((item) => item.view === activeView)?.label ?? 'Health';
}

/** Browser tab title: run verdict first so a pinned tab shows pass/fail at a glance. */
export function buildDocumentTitle(
  analysis: AnalysisState | null,
  activeView: WorkspaceView,
): string {
  if (!analysis) return BASE_TITLE;
  const { failing, warnings } = countRunIssues(analysis);
  const verdict =
    failing > 0
      ? `✕ ${failing} failed`
      : warnings > 0
        ? `⚠ ${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`
        : null;
  const segments = [verdict, viewLabel(activeView), analysis.projectName].filter(
    (segment): segment is string => segment != null,
  );
  return `${segments.join(' · ')} — ${BASE_TITLE}`;
}
