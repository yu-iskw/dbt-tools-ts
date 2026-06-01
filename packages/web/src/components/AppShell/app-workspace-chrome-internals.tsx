import { formatRunStartedAt, getInvocationTimestamp } from '@web/lib/analysis-workspace/utils';
import { sourceLabel } from '@web/lib/artifact-source';

import { AnalysisWorkspace } from '../AnalysisWorkspace';
import { ArtifactLoadPanel } from '../ArtifactLoadPanel';

import { LoadingCard } from './LoadingCard';
import { SettingsView } from './SettingsView';

import type { OmniboxResultsSnapshot } from '@web/hooks/use-omnibox-results';
import type { WorkspacePreferences } from '@web/hooks/use-workspace-preferences';
import type { UseWorkspaceUrlStateResult } from '@web/hooks/use-workspace-url-state';
import type { ThemePreference, WorkspaceSignal } from '@web/lib/analysis-workspace/types';
import type { ArtifactLocationSnapshot } from '@web/lib/artifact-source';
import type { AnalysisLoadResult } from '@web/services/analysis-loader';
import type {
  MissingOptionalArtifactsState,
  RemoteArtifactRun,
  WorkspaceArtifactSource,
} from '@web/services/artifact-source-api';
import type { AnalysisState } from '@web/types';
import type { ReactElement, Dispatch, SetStateAction } from 'react';

type HeaderMetricIconKind = 'invocation' | 'project' | 'source' | 'time';

interface HeaderSummaryItemModel {
  key: string;
  label: string;
  value: string;
  icon: HeaderMetricIconKind;
}

interface HeaderModel {
  label: string;
  subtitle: string | null;
  summaryItems: HeaderSummaryItemModel[];
}

function HeaderMetricIcon({ kind }: { kind: HeaderMetricIconKind }) {
  const commonProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (kind === 'invocation') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          {...commonProps}
          d="M20 12.5V7a2 2 0 0 0-2-2h-6.2a2 2 0 0 0-1.4.58l-4.82 4.82A2 2 0 0 0 5 11.82V17a2 2 0 0 0 2 2h5.5"
        />
        <path {...commonProps} d="M9 5v4a2 2 0 0 1-2 2H5" />
        <circle {...commonProps} cx="17.5" cy="17.5" r="3.5" />
      </svg>
    );
  }

  if (kind === 'time') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle {...commonProps} cx="12" cy="12" r="8" />
        <path {...commonProps} d="M12 7.8v4.6l3 1.8" />
      </svg>
    );
  }

  if (kind === 'project') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          {...commonProps}
          d="M3.5 8.5a2 2 0 0 1 2-2h3l1.4 1.7h8.6a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        {...commonProps}
        d="M11.25 4.75 5.5 7.7v4.55c0 3.65 2.7 6.95 6.5 7.95 3.8-1 6.5-4.3 6.5-7.95V7.7z"
      />
      <path {...commonProps} d="M9.4 12.15 11.2 14l3.35-3.45" />
    </svg>
  );
}

export function buildHeaderModel(
  analysis: AnalysisState | null,
  analysisSource: WorkspaceArtifactSource | null,
): HeaderModel {
  const projectName = analysis?.projectName ?? null;
  const invocationId = analysis?.invocationId ?? null;
  const warehouseType = analysis?.warehouseType ?? null;
  const invocationTimestamp = analysis ? getInvocationTimestamp(analysis) : null;
  const formattedInvocationTimestamp =
    invocationTimestamp != null ? formatRunStartedAt(invocationTimestamp) : null;

  return {
    label: projectName ?? 'Workspace session',
    subtitle:
      projectName == null && invocationId == null && formattedInvocationTimestamp == null
        ? 'Load artifacts to populate session details.'
        : null,
    summaryItems: [
      invocationId
        ? {
            key: 'invocation',
            label: 'Invocation ID',
            value: invocationId,
            icon: 'invocation',
          }
        : null,
      formattedInvocationTimestamp
        ? {
            key: 'timestamp',
            label: 'Timestamp',
            value: formattedInvocationTimestamp,
            icon: 'time',
          }
        : null,
      {
        key: 'source',
        label: 'Source mode',
        value: sourceLabel(analysisSource),
        icon: 'source',
      },
      warehouseType
        ? {
            key: 'warehouse',
            label: 'Warehouse type',
            value: warehouseType.charAt(0).toUpperCase() + warehouseType.slice(1),
            icon: 'project',
          }
        : null,
    ].filter((value): value is HeaderSummaryItemModel => value != null),
  };
}

function HeaderSummary({ summaryItems }: { summaryItems: HeaderSummaryItemModel[] }) {
  return (
    <div className="app-header__summary-grid" aria-label="Session metadata">
      {summaryItems.map((item) => (
        <div key={item.key} className="app-header__summary-item">
          <span className="app-header__summary-icon">
            <HeaderMetricIcon kind={item.icon} />
          </span>
          <span className="app-header__summary-copy">
            <span className="app-header__summary-label">{item.label}</span>
            <strong className="app-header__summary-value">{item.value}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

export function HeaderIdentity({ header }: { header: HeaderModel }): ReactElement {
  return (
    <div className="app-header__identity">
      <p className="eyebrow" title={header.label}>
        {header.label}
      </p>
      {header.subtitle ? <p className="app-header__subheadline">{header.subtitle}</p> : null}
      <HeaderSummary summaryItems={header.summaryItems} />
    </div>
  );
}

export function HeaderSearch({
  analysis,
  searchState,
  setSearchState,
  omniboxResults,
  handleNavigateTo,
}: {
  analysis: AnalysisState | null;
  searchState: UseWorkspaceUrlStateResult['searchState'];
  setSearchState: UseWorkspaceUrlStateResult['setSearchState'];
  omniboxResults: OmniboxResultsSnapshot;
  handleNavigateTo: UseWorkspaceUrlStateResult['handleNavigateTo'];
}): ReactElement {
  const showsQueryResults = searchState.query.trim().length > 0;

  return (
    <div className="app-header__omnibox">
      <label className="app-header__search-control">
        <div className="app-header__search-shell">
          <svg className="workspace-search__icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M16 16l4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <input
            value={searchState.query}
            onFocus={() => setSearchState((current) => ({ ...current, isOpen: true }))}
            onChange={(e) =>
              setSearchState((current) => ({
                ...current,
                query: e.target.value,
                isOpen: true,
              }))
            }
            placeholder="Search runs, pipelines, assets..."
            aria-label="Global search"
          />
        </div>
      </label>
      {searchState.isOpen && analysis && (
        <div className="omnibox-results">
          {omniboxResults.loading && showsQueryResults ? (
            <div className="omnibox-results__empty">Searching…</div>
          ) : omniboxResults.results.length > 0 ? (
            omniboxResults.results.map((resource) => (
              <button
                key={resource.uniqueId}
                type="button"
                className="omnibox-results__item"
                onClick={() => {
                  setSearchState((current) => ({
                    ...current,
                    isOpen: false,
                    recentResourceIds: [
                      resource.uniqueId,
                      ...current.recentResourceIds.filter((id) => id !== resource.uniqueId),
                    ].slice(0, 8),
                  }));
                  handleNavigateTo('inventory', {
                    resourceId: resource.uniqueId,
                    assetTab: 'summary',
                  });
                }}
              >
                <strong>{resource.name}</strong>
                <span>{resource.resourceType}</span>
              </button>
            ))
          ) : (
            <div className="omnibox-results__empty">
              {showsQueryResults ? 'No matching resources' : 'Recent items will appear here'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkspaceContent({
  activeView,
  analysis,
  analysisSource,
  artifactLocationSnapshot,
  preloadLoading,
  pendingRemoteRun,
  acceptingRemoteRun,
  preferences,
  setPreferences,
  themePreference,
  setThemePreference,
  onManagedLoadStarted,
  onManagedLoadEnded,
  onManagedAnalysisLoaded,
  onError,
  onAcceptPendingRemoteRun,
  workspaceSignals,
  overviewFilters,
  setOverviewFilters,
  timelineFilters,
  setTimelineFilters,
  assetViewState,
  setAssetViewState,
  runsViewState,
  setRunsViewState,
  lineageViewState,
  setLineageViewState,
  setInvestigationSelection,
  handleNavigateTo,
}: {
  activeView: UseWorkspaceUrlStateResult['activeView'];
  analysis: AnalysisState | null;
  analysisSource: WorkspaceArtifactSource | null;
  artifactLocationSnapshot: ArtifactLocationSnapshot | null;
  preloadLoading: boolean;
  pendingRemoteRun: RemoteArtifactRun | null;
  acceptingRemoteRun: boolean;
  preferences: WorkspacePreferences;
  setPreferences: Dispatch<SetStateAction<WorkspacePreferences>>;
  themePreference: ThemePreference;
  setThemePreference: Dispatch<SetStateAction<ThemePreference>>;
  onManagedLoadStarted: () => number;
  onManagedLoadEnded: (loadGeneration: number) => void;
  onManagedAnalysisLoaded: (
    result: AnalysisLoadResult,
    source: 'preload' | 'remote',
    optionalArtifacts: MissingOptionalArtifactsState,
    loadGeneration: number,
  ) => void;
  onError: (error: string | null) => void;
  onAcceptPendingRemoteRun: () => Promise<void>;
  workspaceSignals: WorkspaceSignal[];
  overviewFilters: UseWorkspaceUrlStateResult['overviewFilters'];
  setOverviewFilters: UseWorkspaceUrlStateResult['setOverviewFilters'];
  timelineFilters: UseWorkspaceUrlStateResult['timelineFilters'];
  setTimelineFilters: UseWorkspaceUrlStateResult['setTimelineFilters'];
  assetViewState: UseWorkspaceUrlStateResult['assetViewState'];
  setAssetViewState: UseWorkspaceUrlStateResult['setAssetViewState'];
  runsViewState: UseWorkspaceUrlStateResult['runsViewState'];
  setRunsViewState: UseWorkspaceUrlStateResult['setRunsViewState'];
  lineageViewState: UseWorkspaceUrlStateResult['lineageViewState'];
  setLineageViewState: UseWorkspaceUrlStateResult['setLineageViewState'];
  setInvestigationSelection: UseWorkspaceUrlStateResult['setInvestigationSelection'];
  handleNavigateTo: UseWorkspaceUrlStateResult['handleNavigateTo'];
}): ReactElement {
  if (activeView === 'settings') {
    return (
      <SettingsView
        preferences={preferences}
        setPreferences={setPreferences}
        themePreference={themePreference}
        setThemePreference={setThemePreference}
        analysisSource={analysisSource}
        artifactLocationSnapshot={artifactLocationSnapshot}
        executionCount={analysis?.summary.total_nodes ?? null}
        onManagedLoadStarted={onManagedLoadStarted}
        onManagedLoadEnded={onManagedLoadEnded}
        onManagedAnalysisLoaded={onManagedAnalysisLoaded}
        onError={onError}
        pendingRemoteRun={pendingRemoteRun}
        acceptingRemoteRun={acceptingRemoteRun}
        onAcceptPendingRemoteRun={onAcceptPendingRemoteRun}
      />
    );
  }

  if (analysis) {
    return (
      <AnalysisWorkspace
        analysis={analysis}
        activeView={activeView}
        analysisSource={analysisSource}
        overviewFilters={overviewFilters}
        onOverviewFiltersChange={setOverviewFilters}
        timelineFilters={timelineFilters}
        onTimelineFiltersChange={setTimelineFilters}
        assetViewState={assetViewState}
        onAssetViewStateChange={setAssetViewState}
        runsViewState={runsViewState}
        onRunsViewStateChange={setRunsViewState}
        lineageViewState={lineageViewState}
        onLineageViewStateChange={setLineageViewState}
        onInvestigationSelectionChange={setInvestigationSelection}
        onNavigateTo={handleNavigateTo}
        workspaceSignals={workspaceSignals}
      />
    );
  }

  if (preloadLoading) {
    return <LoadingCard />;
  }

  return (
    <ArtifactLoadPanel
      onManagedLoadStarted={onManagedLoadStarted}
      onManagedLoadEnded={onManagedLoadEnded}
      onManagedLoad={onManagedAnalysisLoaded}
      onError={onError}
    />
  );
}
