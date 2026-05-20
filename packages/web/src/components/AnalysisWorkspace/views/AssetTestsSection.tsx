import { useMemo, useState } from 'react';

import { NOT_EXECUTED } from '@web/lib/analysis-workspace/catalog-copy';
import { buildSelectedAssetTestEvidence } from '@web/lib/analysis-workspace/explorer-tree';
import {
  sortSelectedAssetTests,
  type AssetTestsSortDirection,
  type AssetTestsSortKey,
} from '@web/lib/analysis-workspace/selected-asset-tests-sort';
import { formatSeconds, badgeClassName } from '@web/lib/analysis-workspace/utils';

import { SectionCard, ResourceTypeBadge } from '../shared';

import type { AssetViewState, WorkspaceView } from '@web/lib/analysis-workspace/types';
import type { AnalysisState, ResourceNode } from '@web/types';
import type { ReactElement } from 'react';

function selectedAssetQualityPosture(evidence: ReturnType<typeof buildSelectedAssetTestEvidence>): {
  label: string;
  tone: 'neutral' | 'positive' | 'warning';
  detail: string;
} {
  if (evidence.total === 0) {
    return {
      label: 'No attached tests',
      tone: 'neutral',
      detail: 'No quality evidence was linked to this asset in the current artifacts.',
    };
  }
  if (evidence.attention > 0) {
    return {
      label: 'Attention needed',
      tone: 'warning',
      detail: `${evidence.attention} attention item${evidence.attention === 1 ? '' : 's'} across ${evidence.total} attached tests.`,
    };
  }
  return {
    label: 'All attached tests passing',
    tone: 'positive',
    detail: `${evidence.passing} of ${evidence.total} attached tests passed in the current artifacts.`,
  };
}

function columnHeaderSortUi(
  sortedBy: AssetTestsSortKey,
  columnKey: AssetTestsSortKey,
  direction: AssetTestsSortDirection,
): {
  indicator: string;
  ariaSort: 'ascending' | 'descending' | 'none';
} {
  if (sortedBy !== columnKey) {
    return { indicator: ' ', ariaSort: 'none' };
  }
  return direction === 'asc'
    ? { indicator: '↑', ariaSort: 'ascending' }
    : { indicator: '↓', ariaSort: 'descending' };
}

function nextSortDirection(
  sortKey: AssetTestsSortKey,
  nextKey: AssetTestsSortKey,
  currentDirection: AssetTestsSortDirection,
): AssetTestsSortDirection {
  if (sortKey === nextKey) {
    return currentDirection === 'asc' ? 'desc' : 'asc';
  }
  return nextKey === 'status' || nextKey === 'duration' ? 'desc' : 'asc';
}

const HEADER_COLUMNS = [
  { key: 'test', label: 'Test', alignEnd: false, testCell: true },
  { key: 'status', label: 'Status', alignEnd: false, testCell: false },
  { key: 'type', label: 'Type', alignEnd: false, testCell: false },
  { key: 'target', label: 'Target', alignEnd: false, testCell: false },
  { key: 'duration', label: 'Duration', alignEnd: true, testCell: false },
] satisfies ReadonlyArray<{
  key: AssetTestsSortKey;
  label: string;
  alignEnd: boolean;
  testCell: boolean;
}>;

export function AssetTestsSection({
  resource,
  analysis,
  onNavigateTo,
}: {
  resource: ResourceNode;
  analysis: AnalysisState;
  onNavigateTo: (
    view: WorkspaceView,
    options?: {
      resourceId?: string;
      executionId?: string;
      assetTab?: AssetViewState['activeTab'];
      rootResourceId?: string;
    },
  ) => void;
}): ReactElement {
  const [sortKey, setSortKey] = useState<AssetTestsSortKey>('status');
  const [sortDirection, setSortDirection] = useState<AssetTestsSortDirection>('desc');
  const evidence = useMemo(
    () =>
      buildSelectedAssetTestEvidence(
        resource.uniqueId,
        analysis.resources,
        analysis.dependencyIndex,
      ),
    [analysis.dependencyIndex, analysis.resources, resource.uniqueId],
  );
  const qualityPosture = selectedAssetQualityPosture(evidence);
  const sortedTests = useMemo(
    () => sortSelectedAssetTests(evidence.tests, sortKey, sortDirection),
    [evidence.tests, sortDirection, sortKey],
  );

  const setSortFromHeader = (nextKey: AssetTestsSortKey) => {
    setSortDirection((currentDirection) => nextSortDirection(sortKey, nextKey, currentDirection));
    setSortKey(nextKey);
  };

  return (
    <SectionCard title="Tests" subtitle="Quality evidence and related dependency posture.">
      <div className="asset-tests-summary">
        <div className="asset-tests-summary__headline">
          <span className={`tone-badge tone-badge--${qualityPosture.tone}`}>
            {qualityPosture.label}
          </span>
          <p>{qualityPosture.detail}</p>
        </div>
        <div className="asset-tests-summary__metrics" aria-label="Test summary">
          <span className="asset-tests-summary__metric">
            <strong>{evidence.total}</strong>
            <span>Attached tests</span>
          </span>
          <span className="asset-tests-summary__metric">
            <strong>{evidence.passing}</strong>
            <span>Passing</span>
          </span>
          <span className="asset-tests-summary__metric">
            <strong>{evidence.attention}</strong>
            <span>Attention items</span>
          </span>
        </div>
      </div>
      {evidence.tests.length === 0 ? (
        <p className="resource-spotlight__description resource-spotlight__description--muted">
          No attached tests were found for this asset in the current artifacts.
        </p>
      ) : (
        <div className="asset-tests-table" aria-label="Attached tests evidence">
          <div className="asset-tests-table__toolbar">
            <p className="asset-tests-table__caption">
              Compare attached test evidence by status, target, duration, and type. Failed and
              warned tests include run messages when dbt provides them.
            </p>
          </div>
          <div className="asset-tests-table__header" role="row">
            {HEADER_COLUMNS.map(({ key, label, alignEnd, testCell }) => {
              const sortUi = columnHeaderSortUi(sortKey, key, sortDirection);
              return (
                <div
                  key={key}
                  className={`asset-tests-table__cell${testCell ? ' asset-tests-table__cell--test' : ''}${alignEnd ? ' asset-tests-table__cell--align-end' : ''}`}
                  role="columnheader"
                  aria-sort={sortUi.ariaSort}
                >
                  <button
                    type="button"
                    className={`asset-tests-table__sort-button${alignEnd ? ' asset-tests-table__sort-button--align-end' : ''}`}
                    onClick={() => setSortFromHeader(key)}
                  >
                    {label}
                    <span className="asset-tests-table__sort-indicator" aria-hidden="true">
                      {sortUi.indicator}
                    </span>
                  </button>
                </div>
              );
            })}
            <div
              className="asset-tests-table__cell asset-tests-table__cell--align-end"
              role="columnheader"
            >
              Action
            </div>
          </div>
          <div className="asset-tests-table__body">
            {sortedTests.map((test) => {
              const showRunMessage =
                test.runResultMessage != null &&
                test.runResultMessage !== '' &&
                (test.statusTone === 'danger' || test.statusTone === 'warning');
              const ariaRun = test.testAttachedTarget
                ? `Open ${test.name} (${test.testAttachedTarget}) in runs`
                : `Open ${test.name} in runs`;
              return (
                <div key={test.uniqueId} className="asset-tests-table__row-group">
                  <button
                    type="button"
                    className="asset-tests-table__row"
                    aria-label={ariaRun}
                    onClick={() =>
                      onNavigateTo('runs', {
                        executionId: test.uniqueId,
                      })
                    }
                  >
                    <div className="asset-tests-table__cell asset-tests-table__cell--test">
                      <strong title={test.name}>{test.name}</strong>
                      <span className="asset-tests-table__pkg">
                        {test.packageName || 'workspace'}
                      </span>
                    </div>
                    <div className="asset-tests-table__cell" data-label="Status">
                      <span className={badgeClassName(test.statusTone)}>
                        {test.status ?? NOT_EXECUTED}
                      </span>
                    </div>
                    <div className="asset-tests-table__cell" data-label="Type">
                      <ResourceTypeBadge resourceType={test.resourceType} />
                    </div>
                    <div
                      className="asset-tests-table__cell asset-tests-table__cell--target"
                      data-label="Target"
                      title={test.testAttachedTarget ?? undefined}
                    >
                      {test.testAttachedTarget ?? '—'}
                    </div>
                    <div
                      className="asset-tests-table__cell asset-tests-table__cell--align-end"
                      data-label="Duration"
                    >
                      {formatSeconds(test.executionTime)}
                    </div>
                    <div
                      className="asset-tests-table__cell asset-tests-table__cell--align-end asset-tests-table__cell--action"
                      data-label="Action"
                    >
                      <span className="asset-tests-table__open-runs-icon" aria-hidden="true">
                        <svg
                          viewBox="0 0 16 16"
                          width="18"
                          height="18"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.35"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4.25 11.75 11.25 4.75" />
                          <path d="M5.5 4.75h5.75v5.75" />
                        </svg>
                      </span>
                    </div>
                  </button>
                  {showRunMessage ? (
                    <div
                      className={`asset-tests-table__run-message${test.statusTone === 'warning' ? ' asset-tests-table__run-message--warn' : ''}`}
                      role="note"
                      aria-label={`dbt message for ${test.name}`}
                    >
                      {test.runResultMessage}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
