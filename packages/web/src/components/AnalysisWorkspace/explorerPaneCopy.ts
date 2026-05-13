import type { DashboardStatusFilter } from '@web/lib/analysis-workspace/types';

/** User-facing copy for explorer metrics; exported for unit tests. */
export const EXPLORER_UI_COPY = {
  resourceTypeSummaryAriaLabel:
    'Run outcomes for executed dbt assets (non-test resources such as models and sources), grouped by resource type. Counts are how many assets succeeded versus had warnings or failures. These are not dbt test pass or fail totals.',
  resourceTypeSummaryTitle:
    'Run outcomes for executed dbt assets by type (excludes tests). Not dbt test pass or fail totals.',
  resourceTypeSummaryItemTitle(typeLabel: string): string {
    return `${typeLabel}: executed asset run outcomes for this type, not dbt test totals.`;
  },
  treeTestStatsTitle:
    'Attention-only rollup of executed dbt test outcomes for this folder or row: failed or errored, warning, and dbt-skipped. Passing tests and tests with no run result (not executed) are not shown here. A test that depends on multiple resources may be counted more than once in folder totals.',
  treeTestStatsBranchAriaLabel:
    'Dbt test attention rollup for resources in this folder: failed or error, warning, and skipped counts only. Passing tests and not-executed tests are not shown. Tests with multiple upstream dependencies may be counted more than once when summed at higher folders.',
  treeTestStatsLeafAriaLabel:
    'Dbt test attention outcomes for this resource: failed or error, warning, and skipped only. Passing tests and not-executed tests are not shown.',
  treeTestStatErrorTitle(count: number): string {
    return `Failed or errored dbt test attachments: ${count}`;
  },
  treeTestStatWarnTitle(count: number): string {
    return `Warning dbt test attachments: ${count}`;
  },
  treeTestStatSkippedTitle(count: number): string {
    return `Dbt skipped or no-op test attachments: ${count}. Folder rollups may count one test multiple times when it depends on several resources.`;
  },
  treeEmptyHeadline: 'No resources found',
  treeEmptyDefaultSubtext: 'Adjust filters or search to find matching branches or assets.',
  treeEmptySearchSubtext: 'Try clearing or changing the resource search box.',
  treeEmptyResourceTypesSubtext:
    'One or more dbt resource types are narrowed; add types or reset type filters to see more assets.',
  treeEmptyMaterializationSubtext:
    'Materialization filters are narrowing the tree; clear or broaden them to see more assets (values come from manifest metadata).',
  treeEmptyExecutionFilterSubtext(status: DashboardStatusFilter): string {
    switch (status) {
      case 'danger':
        return 'Execution status is Fail: only assets with a failed or errored result in this run are shown. Assets without a run row are treated as Not executed, not Fail. For models whose run succeeded but dbt tests failed, use Issues. Try Execution status All, or confirm run results are loaded for this workspace.';
      case 'issues':
        return 'Execution status is Issues: assets with a failed or errored run result, or with failed, warned, or skipped dbt test attachments in this run. Fail shows execution failures only.';
      case 'neutral':
        return 'Execution status is Not executed: only assets without a matching run result (or unknown status) are shown. Try All or confirm run results are loaded.';
      case 'positive':
        return 'Execution status is Success: only successful runs are shown. Try All or adjust other filters.';
      case 'warning':
        return 'Execution status is Warn: only warned runs are shown. Try All or adjust other filters.';
      case 'skipped':
        return 'Execution status is Skipped: only skipped runs are shown. Try All or adjust other filters.';
      default:
        return '';
    }
  },
  /** Section heading above run-outcome and problems rows. */
  executionStatusSectionTitle: 'Filter by run & tests',
  /** Subheading for the primary run-outcome pill row. */
  executionStatusRunOutcomeSubLabel: 'Run outcome',
  /** Subheading for the issues pill (run failure or test attention). */
  executionStatusProblemsSubLabel: 'Run + dbt tests',
} as const;

/** Short button labels for execution status filters (filter values unchanged). */
export function executionStatusPillLabel(status: DashboardStatusFilter): string {
  switch (status) {
    case 'all':
      return 'All';
    case 'positive':
      return 'Success';
    case 'warning':
      return 'Warn';
    case 'danger':
      return 'Fail (run)';
    case 'skipped':
      return 'Skipped';
    case 'neutral':
      return 'Not executed';
    case 'issues':
      return 'Issues (run or tests)';
    default:
      return status;
  }
}

/** `title` / `aria-description` text aligned with empty-state filter explanations. */
export function executionStatusFilterButtonTitle(status: DashboardStatusFilter): string {
  if (status === 'all') {
    return 'Show all assets regardless of run outcome or attached dbt test results.';
  }
  return EXPLORER_UI_COPY.treeEmptyExecutionFilterSubtext(status);
}

/** Composes explorer tree empty copy when filters or search yield zero rows. Exported for unit tests. */
export function buildExplorerTreeEmptySubtext(options: {
  status: DashboardStatusFilter;
  resourceQuery: string;
  activeResourceTypeCount: number;
  activeMaterializationKindCount?: number;
}): string {
  const parts: string[] = [];
  if (options.status !== 'all') {
    parts.push(EXPLORER_UI_COPY.treeEmptyExecutionFilterSubtext(options.status));
  }
  if (options.resourceQuery.trim()) {
    parts.push(EXPLORER_UI_COPY.treeEmptySearchSubtext);
  }
  if (options.activeResourceTypeCount > 0) {
    parts.push(EXPLORER_UI_COPY.treeEmptyResourceTypesSubtext);
  }
  if ((options.activeMaterializationKindCount ?? 0) > 0) {
    parts.push(EXPLORER_UI_COPY.treeEmptyMaterializationSubtext);
  }
  if (parts.length === 0) {
    return EXPLORER_UI_COPY.treeEmptyDefaultSubtext;
  }
  return parts.join(' ');
}
