import { getAdapterResponseFieldsBeyondNormalized } from '@dbt-tools/core/browser';

import {
  getRunsAdapterField,
  type RunsAdapterColumn,
} from '@web/lib/analysis-workspace/runs-adapter-columns';
import { formatSeconds } from '@web/lib/analysis-workspace/utils';

import { NodeActions } from '../../NodeActions';
import { RunResultMessage } from '../../RunResultMessage';
import { EntityInspector, formatResourceTypeLabel } from '../../shared';

import type { NodeActionContext, NodeNavigate } from '@web/lib/analysis-workspace/node-actions';
import type { ExecutionRow } from '@web/types';
import type { ReactElement } from 'react';

function formatInspectorFields(row: ExecutionRow, columns: RunsAdapterColumn[]): string {
  const lines = columns.map((column) => {
    const field = getRunsAdapterField(row, column.key);
    return `${column.label}: ${field?.displayValue ?? '—'}`;
  });
  return lines.join('\n');
}

const RAW_ADAPTER_RESPONSE_FIELDS_LABEL = 'Raw adapter response fields';
const ADAPTER_METRICS_LABEL = 'Adapter metrics';

export function RunsAdapterInspector({
  row,
  visibleColumns,
  overflowColumns,
  nodeActionContext,
  onNavigateTo,
}: {
  row: ExecutionRow | null;
  visibleColumns: RunsAdapterColumn[];
  overflowColumns: RunsAdapterColumn[];
  nodeActionContext: NodeActionContext;
  onNavigateTo: NodeNavigate;
}): ReactElement | null {
  if (!row) return null;

  const adapterFieldCount = row.adapterResponseFields?.length ?? 0;
  const extraAdapterRawFields = getAdapterResponseFieldsBeyondNormalized(
    row.adapterMetrics,
    row.adapterResponseFields,
  );
  const normalizedSections =
    visibleColumns.length > 0 || overflowColumns.length > 0
      ? [
          ...(visibleColumns.length > 0
            ? [
                {
                  label: ADAPTER_METRICS_LABEL,
                  value: formatInspectorFields(row, visibleColumns),
                },
              ]
            : []),
          ...(overflowColumns.length > 0
            ? [
                {
                  label: 'More adapter metrics',
                  value: formatInspectorFields(row, overflowColumns),
                },
              ]
            : []),
        ]
      : row.adapterMetrics
        ? [
            {
              label: ADAPTER_METRICS_LABEL,
              value:
                'This row has normalized adapter metrics but none are configured as visible columns.',
            },
          ]
        : [];
  const rawFieldSection =
    adapterFieldCount === 0
      ? [
          {
            label: RAW_ADAPTER_RESPONSE_FIELDS_LABEL,
            value: 'This row has no adapter_response fields.',
          },
        ]
      : extraAdapterRawFields.length > 0
        ? [
            {
              label: RAW_ADAPTER_RESPONSE_FIELDS_LABEL,
              value: extraAdapterRawFields
                .map((field) => `${field.label}: ${field.displayValue}`)
                .join('\n'),
            },
          ]
        : [];
  const sections = [...normalizedSections, ...rawFieldSection];

  return (
    <EntityInspector
      eyebrow="Selected run item"
      title={row.name}
      typeLabel={formatResourceTypeLabel(row.resourceType)}
      callout={<RunResultMessage message={row.runResultMessage} statusTone={row.statusTone} />}
      stats={[
        { label: 'Status', value: row.status },
        { label: 'Duration', value: formatSeconds(row.executionTime) },
        { label: 'Thread', value: row.threadId ?? 'n/a' },
        {
          label: ADAPTER_METRICS_LABEL,
          value: String(visibleColumns.length + overflowColumns.length),
        },
        {
          label: 'Extra raw fields',
          value: String(extraAdapterRawFields.length),
        },
      ]}
      sections={sections}
      footer={
        <NodeActions
          nodeId={row.uniqueId}
          context={nodeActionContext}
          exclude={['runs']}
          onNavigateTo={onNavigateTo}
        />
      }
    />
  );
}
