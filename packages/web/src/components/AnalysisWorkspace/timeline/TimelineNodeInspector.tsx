import { formatSeconds } from '@web/lib/analysis-workspace/utils';

import { NodeActions } from '../NodeActions';
import { RunResultMessage } from '../RunResultMessage';
import { EntityInspector, formatResourceTypeLabel } from '../shared';

import { formatMs } from './gantt/formatting';

import type { TestStats } from '@web/lib/analysis-workspace/explorer-tree';
import type { NodeActionContext, NodeNavigate } from '@web/lib/analysis-workspace/node-actions';
import type { ExecutionRow, GanttItem } from '@web/types';
import type { ReactElement } from 'react';

/** Detail panel for the Timeline bar the user selected, with the shared cross-view actions. */
export function TimelineNodeInspector({
  item,
  execution,
  testStats,
  nodeActionContext,
  onNavigateTo,
  onClose,
}: {
  item: GanttItem;
  execution: ExecutionRow | null;
  testStats: TestStats | undefined;
  nodeActionContext: NodeActionContext;
  onNavigateTo: NodeNavigate;
  onClose: () => void;
}): ReactElement {
  const stats = [
    { label: 'Status', value: execution?.status ?? item.status },
    {
      label: 'Duration',
      value: execution ? formatSeconds(execution.executionTime) : formatMs(item.duration),
    },
    { label: 'Start–End', value: `${formatMs(item.start)} – ${formatMs(item.end)}` },
    ...(testStats
      ? [
          {
            label: 'Tests',
            value: `${testStats.pass} passed · ${testStats.error + testStats.warn} failed`,
          },
        ]
      : []),
  ];

  return (
    <EntityInspector
      eyebrow="Selected timeline node"
      title={item.name}
      typeLabel={formatResourceTypeLabel(item.resourceType)}
      status={
        <button
          type="button"
          className="icon-button entity-inspector__close"
          aria-label="Close inspector"
          title="Close"
          onClick={onClose}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      }
      callout={
        <RunResultMessage
          message={execution?.runResultMessage}
          statusTone={execution?.statusTone}
        />
      }
      stats={stats}
      footer={
        <NodeActions
          nodeId={item.unique_id}
          context={nodeActionContext}
          exclude={['timeline']}
          onNavigateTo={onNavigateTo}
        />
      }
    />
  );
}
