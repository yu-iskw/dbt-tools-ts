import { useMemo } from 'react';
import {
  ADAPTER_METRIC_DESCRIPTORS,
  getPresentAdapterTotalDescriptors,
} from '@dbt-tools/core/browser';
import type { AnalysisState } from '@web/types';
import {
  PRIMARY_PROJECT_SUMMARY_GROUPS,
  TEST_RESOURCE_TYPES,
} from '@web/lib/analysis-workspace/constants';
import { isMainProjectResource } from '@web/lib/analysis-workspace/utils';

function groupKeyForResourceType(resourceType: string): string {
  return TEST_RESOURCE_TYPES.has(resourceType) ? 'tests' : resourceType;
}

export function HealthMetricRow({
  analysis,
  projectName,
}: {
  analysis: AnalysisState;
  projectName: string | null;
}) {
  const items = useMemo(() => {
    const mainResources = analysis.resources.filter((r) => isMainProjectResource(r, projectName));
    const grouped = new Map<string, number>();
    for (const r of mainResources) {
      const k = groupKeyForResourceType(r.resourceType);
      grouped.set(k, (grouped.get(k) ?? 0) + 1);
    }

    const row: { label: string; value: string }[] = [];

    for (const { key, label } of PRIMARY_PROJECT_SUMMARY_GROUPS) {
      const n = grouped.get(key) ?? 0;
      if (n > 0) {
        row.push({ label, value: n.toLocaleString() });
      }
    }

    const documented = analysis.resources.filter((r) => Boolean(r.description?.trim())).length;
    const totalRes = analysis.resources.length;
    const coveragePct = totalRes > 0 ? Math.round((documented / totalRes) * 100) : 0;
    row.push({
      label: 'Coverage',
      value: `${coveragePct}%`,
    });

    row.push({
      label: 'Graph nodes',
      value: analysis.graphSummary.totalNodes.toLocaleString(),
    });
    row.push({
      label: 'Edges',
      value: analysis.graphSummary.totalEdges.toLocaleString(),
    });

    const adapter = analysis.adapterTotals;
    if (adapter != null && adapter.nodesWithAdapterData > 0) {
      row.push({
        label: 'Warehouse nodes',
        value: adapter.nodesWithAdapterData.toLocaleString(),
      });
      for (const descriptor of getPresentAdapterTotalDescriptors(adapter)) {
        const totalKey = descriptor.summaryTotalKey;
        const value = totalKey != null ? adapter[totalKey] : undefined;
        if (typeof value !== 'number') continue;
        row.push({
          label:
            ADAPTER_METRIC_DESCRIPTORS.find((item) => item.key === descriptor.key)?.shortLabel ??
            descriptor.shortLabel,
          value: value.toLocaleString(),
        });
      }
    }

    return row;
  }, [analysis, projectName]);

  if (items.length === 0) return null;

  return (
    <div className="health-metric-row" role="region" aria-label="Workspace metrics">
      {items.map((item, i) => (
        <div key={`${item.label}-${i}`} className="health-metric-row__item">
          <span className="health-metric-row__label">{item.label}</span>
          <strong className="health-metric-row__value">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
