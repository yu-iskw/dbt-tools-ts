import type { ReactNode } from 'react';
import { EmptyState } from '../../EmptyState';
import type { MetricDefinition, ResourceNode, SemanticModelDefinition } from '@web/types';
import { NOT_CAPTURED } from '@web/lib/analysis-workspace/catalogCopy';
import { SectionCard } from '../shared';
import { SqlPanel } from './AssetsViewSqlPanel';
import { Spinner } from '../../ui/Spinner';

function DefinitionList({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="definition-list">
      <span>{label}</span>
      <div className="definition-list__values">
        {values.map((value) => (
          <span key={value} className="definition-pill">
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function renderMetricDefinition(definition: MetricDefinition): ReactNode {
  return (
    <div className="definition-panel">
      <div className="detail-grid">
        <div className="detail-stat">
          <span>Label</span>
          <strong>{definition.label ?? NOT_CAPTURED}</strong>
        </div>
        <div className="detail-stat">
          <span>Metric type</span>
          <strong>{definition.metricType ?? NOT_CAPTURED}</strong>
        </div>
        <div className="detail-stat">
          <span>Source</span>
          <strong>{definition.sourceReference ?? NOT_CAPTURED}</strong>
        </div>
        <div className="detail-stat">
          <span>Time granularity</span>
          <strong>{definition.timeGranularity ?? NOT_CAPTURED}</strong>
        </div>
      </div>
      {definition.expression && (
        <div className="definition-block">
          <span>Expression</span>
          <pre>{definition.expression}</pre>
        </div>
      )}
      {definition.description && (
        <div className="definition-block">
          <span>Description</span>
          <p>{definition.description}</p>
        </div>
      )}
      <DefinitionList label="Measures" values={definition.measures} />
      <DefinitionList label="Referenced metrics" values={definition.metrics} />
      <DefinitionList label="Filters" values={definition.filters} />
    </div>
  );
}

function renderSemanticModelDefinition(definition: SemanticModelDefinition): ReactNode {
  return (
    <div className="definition-panel">
      <div className="detail-grid">
        <div className="detail-stat">
          <span>Label</span>
          <strong>{definition.label ?? NOT_CAPTURED}</strong>
        </div>
        <div className="detail-stat">
          <span>Source model</span>
          <strong>{definition.sourceReference ?? NOT_CAPTURED}</strong>
        </div>
        <div className="detail-stat">
          <span>Default time dimension</span>
          <strong>{definition.defaultTimeDimension ?? NOT_CAPTURED}</strong>
        </div>
      </div>
      <DefinitionList label="Entities" values={definition.entities} />
      <DefinitionList label="Measures" values={definition.measures} />
      <DefinitionList label="Dimensions" values={definition.dimensions} />
      {definition.description && (
        <div className="definition-block">
          <span>Description</span>
          <p>{definition.description}</p>
        </div>
      )}
    </div>
  );
}

function assetSqlOrDefinitionBody({
  showsDefinition,
  definition,
  sqlText,
  codeLoading,
  codeError,
}: {
  showsDefinition: boolean;
  definition: ResourceNode['definition'];
  sqlText: string | undefined;
  codeLoading: boolean;
  codeError: string | null;
}): ReactNode {
  if (showsDefinition && definition) {
    return definition.kind === 'metric'
      ? renderMetricDefinition(definition)
      : renderSemanticModelDefinition(definition);
  }
  if (codeLoading) {
    return (
      <div className="asset-sql-loading" aria-busy="true">
        <Spinner size={28} label="Loading SQL" />
        <span className="asset-sql-loading__label">Loading SQL…</span>
      </div>
    );
  }
  if (codeError) {
    return <EmptyState icon="⚠" headline="Could not load SQL" subtext={codeError} />;
  }
  if (sqlText) {
    return <SqlPanel sql={sqlText} />;
  }
  return (
    <EmptyState
      icon="⌘"
      headline={showsDefinition ? 'No definition available' : 'No SQL available'}
      subtext={
        showsDefinition
          ? 'This resource does not expose enough definition metadata in the current artifacts.'
          : 'This resource does not expose compiled or raw SQL in the current artifacts.'
      }
    />
  );
}

export function AssetSqlOrDefinitionCard({
  showsDefinition,
  definition,
  sqlText,
  codeLoading,
  codeError,
  hasCompiledSql,
}: {
  showsDefinition: boolean;
  definition: ResourceNode['definition'];
  sqlText: string | undefined;
  codeLoading: boolean;
  codeError: string | null;
  hasCompiledSql: boolean;
}) {
  return (
    <SectionCard
      title={showsDefinition ? 'Definition' : 'SQL'}
      subtitle={
        showsDefinition
          ? definition?.kind === 'metric'
            ? 'Structured metric definition captured from the manifest.'
            : 'Structured semantic model definition captured from the manifest.'
          : hasCompiledSql
            ? 'Compiled SQL for the selected resource.'
            : 'Raw SQL captured from the manifest.'
      }
    >
      {assetSqlOrDefinitionBody({
        showsDefinition,
        definition,
        sqlText,
        codeLoading,
        codeError,
      })}
    </SectionCard>
  );
}
