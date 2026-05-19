import {
  formatAdapterMetricValue,
  getAdapterMetricValue,
  getAdapterResponseFieldsBeyondNormalized,
  getPresentAdapterMetricDescriptors,
} from '@dbt-tools/core/browser';

import { useArtifactCapability } from '@web/contexts/ArtifactCapabilityContext';
import { NOT_EXECUTED } from '@web/lib/analysis-workspace/catalog-copy';
import {
  displayResourcePath,
  formatRelationNameForDisplay,
  formatSeconds,
} from '@web/lib/analysis-workspace/utils';

import { ResourceMarkdownDescription } from '../ResourceMarkdownDescription';
import { SectionCard } from '../shared';

import type { ExecutionRow, ResourceNode } from '@web/types';
import type { ReactElement } from 'react';

function warehouseRelationLabel(resource: ResourceNode): string {
  const rel = resource.semantics?.relationName?.trim();
  if (rel) return formatRelationNameForDisplay(rel);
  const db = resource.database?.trim();
  const sch = resource.schema?.trim();
  if (db && sch) return `${db}.${sch}`;
  if (sch) return sch;
  if (db) return db;
  return 'n/a';
}

function AdapterResponseSection({
  adapterMetrics,
  extraAdapterRawFields,
}: {
  adapterMetrics: ExecutionRow['adapterMetrics'] | ResourceNode['adapterMetrics'];
  extraAdapterRawFields: ReturnType<typeof getAdapterResponseFieldsBeyondNormalized>;
}) {
  const adapterMetricDescriptors =
    adapterMetrics != null ? getPresentAdapterMetricDescriptors([adapterMetrics]) : [];
  const showAdapter = extraAdapterRawFields.length > 0 || adapterMetricDescriptors.length > 0;

  if (!showAdapter) return null;

  return (
    <div className="asset-summary__group">
      <p className="asset-summary__group-title">Adapter response</p>
      {adapterMetrics != null && adapterMetricDescriptors.length > 0 ? (
        <div className="detail-grid">
          {adapterMetricDescriptors.map((descriptor) => {
            const value = getAdapterMetricValue(adapterMetrics, descriptor.key);
            return (
              <div className="detail-stat" key={descriptor.key}>
                <span>{descriptor.shortLabel}</span>
                <strong>
                  {value !== undefined ? formatAdapterMetricValue(descriptor, value) : '—'}
                </strong>
              </div>
            );
          })}
        </div>
      ) : null}
      {extraAdapterRawFields.length > 0 ? (
        <div className="asset-summary__adapter-raw" aria-label="Additional adapter response fields">
          {extraAdapterRawFields.map((field) => `${field.label}: ${field.displayValue}`).join('\n')}
        </div>
      ) : null}
    </div>
  );
}

function SourceFreshnessSection({ freshness }: { freshness: ResourceNode['sourceFreshness'] }) {
  if (freshness == null) return null;

  return (
    <SectionCard
      title="Source freshness"
      subtitle="Latest freshness evidence from sources.json when provided."
    >
      <div className="detail-grid">
        <div className="detail-stat">
          <span>Status</span>
          <strong>{freshness.status}</strong>
        </div>
        <div className="detail-stat">
          <span>Age</span>
          <strong>{formatSeconds(freshness.ageSeconds)}</strong>
        </div>
        <div className="detail-stat">
          <span>Max loaded at</span>
          <strong>{freshness.maxLoadedAt ?? 'n/a'}</strong>
        </div>
        <div className="detail-stat">
          <span>Snapshotted at</span>
          <strong>{freshness.snapshottedAt ?? 'n/a'}</strong>
        </div>
      </div>
      {freshness.criteria != null ? (
        <div className="detail-grid">
          <div className="detail-stat">
            <span>Warn after</span>
            <strong>{freshness.criteria.warnAfter ?? 'n/a'}</strong>
          </div>
          <div className="detail-stat">
            <span>Error after</span>
            <strong>{freshness.criteria.errorAfter ?? 'n/a'}</strong>
          </div>
          <div className="detail-stat">
            <span>Filter</span>
            <strong>{freshness.criteria.filter ?? 'n/a'}</strong>
          </div>
        </div>
      ) : null}
      {freshness.error ? (
        <p className="resource-spotlight__description">{freshness.error}</p>
      ) : null}
    </SectionCard>
  );
}

export function AssetSummarySection({
  resource,
  executionRow = null,
}: {
  resource: ResourceNode;
  /** When set, adapter fields fall back from the run row if missing on `resource`. */
  executionRow?: ExecutionRow | null;
}): ReactElement {
  const artifactCapability = useArtifactCapability();
  const adapterMetrics = resource.adapterMetrics ?? executionRow?.adapterMetrics;
  const adapterResponseFields =
    resource.adapterResponseFields ?? executionRow?.adapterResponseFields;
  const extraAdapterRawFields = getAdapterResponseFieldsBeyondNormalized(
    adapterMetrics,
    adapterResponseFields,
  );

  return (
    <div className="asset-summary-stack">
      {artifactCapability.missingCatalog || artifactCapability.missingSources ? (
        <SectionCard
          title="Optional artifacts"
          subtitle="Capabilities limited for this session because some JSON files were not part of the load."
        >
          <ul className="resource-spotlight__description resource-spotlight__description--muted">
            {artifactCapability.missingCatalog ? (
              <li>
                <code>catalog.json</code> was not loaded — column counts and richer warehouse
                metadata may be absent.
              </li>
            ) : null}
            {artifactCapability.missingSources ? (
              <li>
                <code>sources.json</code> was not loaded — source freshness evidence is unavailable.
              </li>
            ) : null}
          </ul>
        </SectionCard>
      ) : null}
      <SectionCard
        title="Resource"
        subtitle="Path, relation, and description from the project manifest."
      >
        <div className="detail-grid">
          <div className="detail-stat">
            <span>Project</span>
            <strong>{resource.packageName?.trim() || 'n/a'}</strong>
          </div>
          <div className="detail-stat">
            <span>Path</span>
            <strong>{displayResourcePath(resource) ?? 'n/a'}</strong>
          </div>
          <div className="detail-stat">
            <span>Relation</span>
            <strong>{warehouseRelationLabel(resource)}</strong>
          </div>
          {resource.catalogStats != null ? (
            <div className="detail-stat">
              <span>Catalog columns</span>
              <strong>{resource.catalogStats.columnCount}</strong>
            </div>
          ) : null}
        </div>
        {resource.description ? (
          <ResourceMarkdownDescription
            markdown={resource.description}
            className="resource-spotlight__description"
          />
        ) : (
          <p className="resource-spotlight__description resource-spotlight__description--muted">
            No description was captured for this asset. Catalog-oriented metadata can surface here
            when present in the manifest.
          </p>
        )}
      </SectionCard>

      <SourceFreshnessSection freshness={resource.sourceFreshness} />

      <SectionCard
        title="This run"
        subtitle="Status, timing, and warehouse feedback from the captured run."
      >
        <div className="asset-summary__groups">
          <div className="detail-grid">
            <div className="detail-stat">
              <span>Status</span>
              <strong>{resource.status ?? NOT_EXECUTED}</strong>
            </div>
            <div className="detail-stat">
              <span>Execution time</span>
              <strong>{formatSeconds(resource.executionTime)}</strong>
            </div>
            <div className="detail-stat">
              <span>Thread</span>
              <strong>{resource.threadId ?? 'n/a'}</strong>
            </div>
          </div>
          <AdapterResponseSection
            adapterMetrics={adapterMetrics}
            extraAdapterRawFields={extraAdapterRawFields}
          />
        </div>
      </SectionCard>
    </div>
  );
}
