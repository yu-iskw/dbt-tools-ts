import { useVirtualizer } from '@tanstack/react-virtual';
import { type ReactNode, useRef, type ReactElement } from 'react';

import {
  getResourceOriginLabel,
  testStatsHasAttention,
  type ExplorerTreeRow,
  type TestStats,
} from '@web/lib/analysis-workspace/explorer-tree';

import { EmptyState } from '../EmptyState';

import { EXPLORER_UI_COPY } from './explorer-pane-copy';
import { MaterializationSemanticsBadge } from './MaterializationSemanticsBadge';
import { ExplorerBranchIcon, ResourceTypeIcon, formatResourceTypeLabel } from './shared';

import type { AssetExplorerMode } from '@web/lib/analysis-workspace/types';
import type { ResourceNode } from '@web/types';

function explorerLeafAriaLabel(resource: ResourceNode): string {
  const typeLabel = formatResourceTypeLabel(resource.resourceType);
  const fileName = getResourceOriginLabel(resource);
  return fileName
    ? `${resource.name}, ${typeLabel}, file ${fileName}`
    : `${resource.name}, ${typeLabel}`;
}

export function ExplorerTreeTestStatsGroup({
  testStats,
  variant,
}: {
  testStats: TestStats;
  variant: 'branch' | 'leaf';
}): ReactElement | null {
  if (!testStatsHasAttention(testStats)) return null;
  const ariaLabel =
    variant === 'branch'
      ? EXPLORER_UI_COPY.treeTestStatsBranchAriaLabel
      : EXPLORER_UI_COPY.treeTestStatsLeafAriaLabel;
  return (
    <span
      className="explorer-tree__test-stats-wrap"
      role="group"
      aria-label={ariaLabel}
      title={EXPLORER_UI_COPY.treeTestStatsTitle}
    >
      <span className="explorer-tree__test-stats-label" aria-hidden="true">
        Test issues
      </span>
      <span className="explorer-tree__test-stats">
        {testStats.error > 0 && (
          <span
            className="explorer-tree__test-stat explorer-tree__test-stat--fail"
            title={EXPLORER_UI_COPY.treeTestStatErrorTitle(testStats.error)}
          >
            ✗{testStats.error}
          </span>
        )}
        {testStats.warn > 0 && (
          <span
            className="explorer-tree__test-stat explorer-tree__test-stat--warn"
            title={EXPLORER_UI_COPY.treeTestStatWarnTitle(testStats.warn)}
          >
            !{testStats.warn}
          </span>
        )}
        {testStats.skipped > 0 && (
          <span
            className="explorer-tree__test-stat explorer-tree__test-stat--skipped"
            title={EXPLORER_UI_COPY.treeTestStatSkippedTitle(testStats.skipped)}
          >
            −{testStats.skipped}
          </span>
        )}
      </span>
    </span>
  );
}

function VirtualExplorerRow({
  virtualRow,
  measureRow,
  children,
}: {
  virtualRow: { index: number; start: number };
  measureRow: (el: HTMLDivElement | null) => void;
  children: ReactNode;
}) {
  return (
    <div
      data-index={virtualRow.index}
      ref={measureRow}
      className="explorer-tree__virtual-row"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${virtualRow.start}px)`,
      }}
    >
      {children}
    </div>
  );
}

export function ExplorerTreeList({
  treeRows,
  explorerMode,
  expandedNodeIds,
  toggleExpandedNode,
  selectedResourceId,
  setSelectedResourceId,
  treeEmptyDisplay,
}: {
  treeRows: ExplorerTreeRow[];
  explorerMode: AssetExplorerMode;
  expandedNodeIds: Set<string>;
  toggleExpandedNode: (id: string) => void;
  selectedResourceId: string | null;
  setSelectedResourceId: (id: string | null) => void;
  /** When the tree has no rows, shown instead of the generic search-only message. */
  treeEmptyDisplay?: { headline: string; subtext: string };
}): ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Initial row height guess before `measureElement` runs (see `.explorer-tree__row` in workspace.css). */
  const explorerTreeRowEstimatePx = 30;

  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-virtual useVirtualizer
  const virtualizer = useVirtualizer({
    count: treeRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => explorerTreeRowEstimatePx,
    overscan: 16,
  });
  const measureRow = virtualizer.measureElement;

  if (treeRows.length === 0) {
    const headline = treeEmptyDisplay?.headline ?? EXPLORER_UI_COPY.treeEmptyHeadline;
    const subtext = treeEmptyDisplay?.subtext ?? EXPLORER_UI_COPY.treeEmptyDefaultSubtext;
    return (
      <div ref={scrollRef} className="explorer-tree">
        <EmptyState icon="🔍" headline={headline} subtext={subtext} />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="explorer-tree">
      <div
        className="explorer-tree__virtual-spacer"
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = treeRows[virtualRow.index];
          if (!row) return null;
          const { node, depth } = row;

          if (node.kind === 'branch') {
            const isExpanded = expandedNodeIds.has(node.id);
            return (
              <VirtualExplorerRow
                key={virtualRow.key}
                virtualRow={virtualRow}
                measureRow={measureRow}
              >
                <button
                  type="button"
                  className="explorer-tree__row explorer-tree__row--branch"
                  style={{ paddingLeft: `${0.9 + depth * 1.05}rem` }}
                  onClick={() => toggleExpandedNode(node.id)}
                >
                  <span
                    className={`explorer-tree__chevron${isExpanded ? ' explorer-tree__chevron--expanded' : ''}`}
                    aria-hidden="true"
                  >
                    ▸
                  </span>
                  <span className="explorer-tree__folder" aria-hidden="true">
                    <ExplorerBranchIcon mode={explorerMode} depth={depth} />
                  </span>
                  <span className="explorer-tree__label">{node.label}</span>
                  {node.testStats && (
                    <ExplorerTreeTestStatsGroup testStats={node.testStats} variant="branch" />
                  )}
                </button>
              </VirtualExplorerRow>
            );
          }

          const resource = node.resource!;
          return (
            <VirtualExplorerRow
              key={virtualRow.key}
              virtualRow={virtualRow}
              measureRow={measureRow}
            >
              <button
                type="button"
                className={
                  resource.uniqueId === selectedResourceId
                    ? 'explorer-tree__row explorer-tree__row--leaf explorer-tree__row--active'
                    : 'explorer-tree__row explorer-tree__row--leaf'
                }
                style={{ paddingLeft: `${0.9 + depth * 1.05}rem` }}
                onClick={() => setSelectedResourceId(resource.uniqueId)}
                title={resource.uniqueId}
                aria-label={explorerLeafAriaLabel(resource)}
              >
                <span className="explorer-tree__leaf-icon" aria-hidden="true">
                  <ResourceTypeIcon resourceType={resource.resourceType} />
                </span>
                <span className="explorer-tree__resource-body">
                  <span className="explorer-tree__label">{resource.name}</span>
                </span>
                {resource.semantics ? (
                  <MaterializationSemanticsBadge semantics={resource.semantics} variant="compact" />
                ) : null}
                {node.testStats && (
                  <ExplorerTreeTestStatsGroup testStats={node.testStats} variant="leaf" />
                )}
              </button>
            </VirtualExplorerRow>
          );
        })}
      </div>
    </div>
  );
}
