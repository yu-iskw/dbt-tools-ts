import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '../../EmptyState';
import type { AnalysisState, ExecutionRow, ResourceNode } from '@web/types';
import type {
  AssetViewState,
  LineageViewState,
  WorkspaceView,
} from '@web/lib/analysis-workspace/types';
import { ResourceTypeBadge } from '../shared';
import { MaterializationSemanticsBadge } from '../MaterializationSemanticsBadge';
import { LineagePanel } from '../lineage/LineagePanel';
import { AssetTestsSection } from './AssetTestsSection';
import { useResourceCode } from '@web/hooks/useResourceCode';
import { AssetSummarySection } from './AssetSummarySection';
import { AssetSqlOrDefinitionCard } from './AssetsViewSqlDefinitionCard';

type AssetSectionId = Exclude<AssetViewState['activeTab'], 'runtime'>;

function normalizeAssetSectionId(activeTab: AssetViewState['activeTab']): AssetSectionId {
  return activeTab === 'runtime' ? 'summary' : activeTab;
}

export function AssetsView({
  resource,
  analysis,
  onSelectResource,
  assetViewState,
  onAssetViewStateChange,
  lineageViewState,
  onLineageViewStateChange,
  onNavigateTo,
}: {
  resource: ResourceNode | null;
  analysis: AnalysisState;
  onSelectResource: (id: string) => void;
  assetViewState: AssetViewState;
  onAssetViewStateChange: Dispatch<SetStateAction<AssetViewState>>;
  lineageViewState: LineageViewState;
  onLineageViewStateChange: Dispatch<SetStateAction<LineageViewState>>;
  onNavigateTo: (
    view: WorkspaceView,
    options?: {
      resourceId?: string;
      executionId?: string;
      assetTab?: AssetViewState['activeTab'];
      rootResourceId?: string;
    },
  ) => void;
}) {
  const resourceById = useMemo(
    () => new Map(analysis.resources.map((entry) => [entry.uniqueId, entry])),
    [analysis.resources],
  );

  const executionRowForSummary: ExecutionRow | null = useMemo(() => {
    if (resource == null) return null;
    return analysis.executions.find((row) => row.uniqueId === resource.uniqueId) ?? null;
  }, [analysis.executions, resource]);

  const upstreamDepth = lineageViewState.upstreamDepth;
  const downstreamDepth = lineageViewState.downstreamDepth;
  const allDepsMode = lineageViewState.allDepsMode;
  const lensMode = lineageViewState.lensMode;
  const activeLegendKeys = lineageViewState.activeLegendKeys;

  const setUpstreamDepth: Dispatch<SetStateAction<number>> = (v) =>
    onLineageViewStateChange((cur) => ({
      ...cur,
      upstreamDepth: typeof v === 'function' ? v(cur.upstreamDepth) : v,
    }));
  const setDownstreamDepth: Dispatch<SetStateAction<number>> = (v) =>
    onLineageViewStateChange((cur) => ({
      ...cur,
      downstreamDepth: typeof v === 'function' ? v(cur.downstreamDepth) : v,
    }));
  const setAllDepsMode: Dispatch<SetStateAction<boolean>> = (v) =>
    onLineageViewStateChange((cur) => ({
      ...cur,
      allDepsMode: typeof v === 'function' ? v(cur.allDepsMode) : v,
    }));
  const setLensMode = (mode: LineageViewState['lensMode']) =>
    onLineageViewStateChange((cur) => ({
      ...cur,
      lensMode: mode,
      activeLegendKeys: new Set(),
    }));
  const setActiveLegendKeys: Dispatch<SetStateAction<Set<string>>> = (value) =>
    onLineageViewStateChange((cur) => ({
      ...cur,
      activeLegendKeys: typeof value === 'function' ? value(cur.activeLegendKeys) : value,
    }));
  const activeSectionId = normalizeAssetSectionId(assetViewState.activeTab);
  const [isLineageDialogOpen, setLineageDialogOpen] = useState(false);
  const sectionRefs = useRef<Record<AssetSectionId, HTMLElement | null>>({
    summary: null,
    lineage: null,
    sql: null,
    tests: null,
  });

  useEffect(() => {
    if (!resource) return;
    const section = sectionRefs.current[activeSectionId];
    if (!section) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({
      block: 'start',
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [activeSectionId, resource]);

  const {
    compiledCode: loadedCompiled,
    rawCode: loadedRaw,
    loading: codeLoading,
    error: codeError,
  } = useResourceCode(resource?.uniqueId ?? null, analysis);

  if (!resource) {
    return (
      <div className="workspace-card">
        <EmptyState
          icon="🔍"
          headline="No resource selected"
          subtext="Adjust the explorer filters or search to find the resource you're looking for."
        />
      </div>
    );
  }

  const dependencySummary = analysis.dependencyIndex[resource.uniqueId];
  const sqlText = loadedCompiled ?? loadedRaw ?? undefined;
  const hasCompiledSql = loadedCompiled != null && loadedCompiled !== '';
  const definition = resource.definition ?? null;
  const showsDefinition = definition?.kind === 'metric' || definition?.kind === 'semantic_model';
  const detailSubtitle = (
    <div className="resource-detail__subtitle">
      <ResourceTypeBadge resourceType={resource.resourceType} />
      {resource.semantics ? <MaterializationSemanticsBadge semantics={resource.semantics} /> : null}
      <span className="resource-detail__package">{resource.packageName || 'workspace'}</span>
    </div>
  );
  const lineagePanelProps = {
    resource,
    dependencySummary,
    dependencyIndex: analysis.dependencyIndex,
    resourceById,
    upstreamDepth,
    downstreamDepth,
    allDepsMode,
    lensMode,
    activeLegendKeys,
    setUpstreamDepth,
    setDownstreamDepth,
    setAllDepsMode,
    setLensMode,
    setActiveLegendKeys,
    onSelectResource: (id: string) => {
      onSelectResource(id);
      onLineageViewStateChange((current) => ({
        ...current,
        selectedResourceId: id,
      }));
      onAssetViewStateChange((current) => ({
        ...current,
        selectedResourceId: id,
        activeTab: 'lineage',
      }));
    },
  } as const;

  return (
    <div className="workspace-view asset-workspace">
      <section className="catalog-detail-hero">
        <div className="catalog-detail-hero__content">
          <p className="eyebrow">Selected asset</p>
          <h3>{resource.name}</h3>
          {detailSubtitle}
        </div>
        <div className="asset-hero__actions" aria-label="Asset actions">
          <button
            type="button"
            className="workspace-pill"
            onClick={() =>
              onNavigateTo('timeline', {
                resourceId: resource.uniqueId,
                executionId: resource.uniqueId,
              })
            }
          >
            Open in Timeline
          </button>
        </div>
      </section>
      <div className="asset-workspace__body">
        <div className="asset-workspace__sections">
          <section
            id="asset-section-summary"
            ref={(node) => {
              sectionRefs.current.summary = node;
            }}
            className="asset-workspace__section"
          >
            <AssetSummarySection resource={resource} executionRow={executionRowForSummary} />
          </section>

          <section
            id="asset-section-lineage"
            ref={(node) => {
              sectionRefs.current.lineage = node;
            }}
            className="asset-workspace__section"
          >
            <LineagePanel
              {...lineagePanelProps}
              displayMode="summary"
              openFullscreen={isLineageDialogOpen}
              onFullscreenChange={setLineageDialogOpen}
            />
          </section>

          <section
            id="asset-section-tests"
            ref={(node) => {
              sectionRefs.current.tests = node;
            }}
            className="asset-workspace__section"
          >
            <AssetTestsSection
              resource={resource}
              analysis={analysis}
              onNavigateTo={onNavigateTo}
            />
          </section>

          <section
            id="asset-section-sql"
            ref={(node) => {
              sectionRefs.current.sql = node;
            }}
            className="asset-workspace__section"
          >
            <AssetSqlOrDefinitionCard
              showsDefinition={showsDefinition}
              definition={definition}
              sqlText={sqlText}
              codeLoading={codeLoading}
              codeError={codeError}
              hasCompiledSql={hasCompiledSql}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
