import type { Dispatch, SetStateAction } from 'react';
import type { WorkspaceSignal } from '../AnalysisWorkspace';
import { ErrorBanner } from '../ErrorBanner';
import type { WorkspacePreferences } from '@web/hooks/useWorkspacePreferences';
import type { ThemePreference } from '@web/lib/analysis-workspace/types';
import type { UseWorkspaceUrlStateResult } from '@web/hooks/useWorkspaceUrlState';
import { useOmniboxResults } from '@web/hooks/useOmniboxResults';
import type { AnalysisLoadResult } from '@web/services/analysisLoader';
import type { ArtifactLocationSnapshot } from '@web/lib/artifactSource';
import type {
  MissingOptionalArtifactsState,
  RemoteArtifactRun,
  WorkspaceArtifactSource,
} from '@web/services/artifactSourceApi';
import type { AnalysisState } from '@web/types';
import { AppSidebar } from './AppSidebar';
import { RemoteUpdateBanner } from './RemoteUpdateBanner';
import {
  buildHeaderModel,
  HeaderIdentity,
  HeaderSearch,
  WorkspaceContent,
} from './appWorkspaceChromeInternals';

export interface AppWorkspaceChromeProps {
  workspace: UseWorkspaceUrlStateResult;
  analysis: AnalysisState | null;
  analysisSource: WorkspaceArtifactSource | null;
  artifactLocationSnapshot: ArtifactLocationSnapshot | null;
  error: string | null;
  preloadLoading: boolean;
  pendingRemoteRun: RemoteArtifactRun | null;
  acceptingRemoteRun: boolean;
  onManagedAnalysisLoaded: (
    result: AnalysisLoadResult,
    source: 'preload' | 'remote',
    optionalArtifacts: MissingOptionalArtifactsState,
  ) => void;
  onError: (error: string | null) => void;
  onAcceptPendingRemoteRun: () => Promise<void>;
  themePreference: ThemePreference;
  setThemePreference: Dispatch<SetStateAction<ThemePreference>>;
  preferences: WorkspacePreferences;
  setPreferences: Dispatch<SetStateAction<WorkspacePreferences>>;
  workspaceSignals: WorkspaceSignal[];
}

export function AppWorkspaceChrome({
  workspace,
  analysis,
  analysisSource,
  artifactLocationSnapshot,
  error,
  preloadLoading,
  pendingRemoteRun,
  acceptingRemoteRun,
  onManagedAnalysisLoaded,
  onError,
  onAcceptPendingRemoteRun,
  themePreference,
  setThemePreference,
  preferences,
  setPreferences,
  workspaceSignals,
}: AppWorkspaceChromeProps) {
  const {
    activeView,
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarOpen,
    setSidebarOpen,
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
    searchState,
    setSearchState,
    setInvestigationSelection,
    setNavigationTarget,
    handleNavigateTo,
    frameClass,
  } = workspace;

  const omniboxResults = useOmniboxResults(analysis, searchState);
  const header = buildHeaderModel(analysis, analysisSource);

  return (
    <div className={frameClass}>
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          role="presentation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AppSidebar
        activeView={activeView}
        setNavigationTarget={setNavigationTarget}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        onNavigate={() => setSidebarOpen(false)}
        analysis={analysis}
        analysisSource={analysisSource}
      />

      <main className="app-main">
        <header className="app-header app-header--workspace">
          <button
            type="button"
            className="hamburger-btn"
            aria-label="Open navigation"
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            onClick={() => setSidebarOpen(true)}
          >
            <span aria-hidden="true">☰</span>
          </button>

          <HeaderIdentity header={header} />

          <HeaderSearch
            analysis={analysis}
            searchState={searchState}
            setSearchState={setSearchState}
            omniboxResults={omniboxResults}
            handleNavigateTo={handleNavigateTo}
          />
        </header>

        {error && <ErrorBanner message={error} />}
        <RemoteUpdateBanner
          pendingRemoteRun={pendingRemoteRun}
          acceptingRemoteRun={acceptingRemoteRun}
          onAcceptPendingRemoteRun={onAcceptPendingRemoteRun}
        />

        <WorkspaceContent
          activeView={activeView}
          analysis={analysis}
          analysisSource={analysisSource}
          artifactLocationSnapshot={artifactLocationSnapshot}
          preloadLoading={preloadLoading}
          pendingRemoteRun={pendingRemoteRun}
          acceptingRemoteRun={acceptingRemoteRun}
          preferences={preferences}
          setPreferences={setPreferences}
          themePreference={themePreference}
          setThemePreference={setThemePreference}
          onManagedAnalysisLoaded={onManagedAnalysisLoaded}
          onError={onError}
          onAcceptPendingRemoteRun={onAcceptPendingRemoteRun}
          workspaceSignals={workspaceSignals}
          overviewFilters={overviewFilters}
          setOverviewFilters={setOverviewFilters}
          timelineFilters={timelineFilters}
          setTimelineFilters={setTimelineFilters}
          assetViewState={assetViewState}
          setAssetViewState={setAssetViewState}
          runsViewState={runsViewState}
          setRunsViewState={setRunsViewState}
          lineageViewState={lineageViewState}
          setLineageViewState={setLineageViewState}
          setInvestigationSelection={setInvestigationSelection}
          handleNavigateTo={handleNavigateTo}
        />
      </main>
    </div>
  );
}
