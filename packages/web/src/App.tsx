import { useEffect, useRef } from 'react';

import { AppWorkspaceChrome } from './components/AppShell/AppWorkspaceChrome';
import { buildWorkspaceSignals } from './components/AppShell/workspace-signals';
import { ToastProvider, useToast } from './components/ui/Toast';
import { ArtifactCapabilityContext } from './contexts/ArtifactCapabilityContext';
import { useAnalysisPage } from './hooks/use-analysis-page';
import { useTheme } from './hooks/use-theme';
import { useWorkspacePreferences } from './hooks/use-workspace-preferences';
import { useWorkspaceUrlState } from './hooks/use-workspace-url-state';

import type { WorkspaceSignal } from './components/AnalysisWorkspace';
import type { AnalysisState } from '@web/types';
import type { ReactElement } from 'react';

function AppContent() {
  const { toast } = useToast();
  const { preferences, setPreferences } = useWorkspacePreferences();
  const workspace = useWorkspaceUrlState(preferences);
  const {
    analysis,
    analysisSource,
    artifactLocationSnapshot,
    error,
    preloadLoading,
    pendingRemoteRun,
    acceptingRemoteRun,
    onManagedAnalysisLoaded,
    artifactCapability,
    onError,
    onAcceptPendingRemoteRun,
  } = useAnalysisPage();
  const { themePreference, setThemePreference } = useTheme();

  useEffect(() => {
    if (preferences.theme !== themePreference) {
      setThemePreference(preferences.theme);
    }
  }, [preferences.theme, setThemePreference, themePreference]);

  const prevAnalysisRef = useRef<AnalysisState | null>(null);
  useEffect(() => {
    if (analysis && !prevAnalysisRef.current && analysisSource === 'preload') {
      toast(`Workspace loaded — ${analysis.summary.total_nodes} executions`, 'positive');
    }
    if (analysis && !prevAnalysisRef.current && analysisSource === 'remote') {
      toast(`Remote workspace loaded — ${analysis.summary.total_nodes} executions`, 'positive');
    }
    prevAnalysisRef.current = analysis;
  }, [analysis, analysisSource, toast]);

  const lastPendingRunIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (pendingRemoteRun == null) {
      lastPendingRunIdRef.current = null;
      return;
    }
    if (lastPendingRunIdRef.current === pendingRemoteRun.runId) return;
    lastPendingRunIdRef.current = pendingRemoteRun.runId;
    toast(`A newer remote run is available: ${pendingRemoteRun.label}`, 'warning');
  }, [pendingRemoteRun, toast]);

  const workspaceSignals: WorkspaceSignal[] = analysis
    ? (buildWorkspaceSignals(analysis, analysisSource) as unknown as WorkspaceSignal[])
    : [];

  return (
    <ArtifactCapabilityContext.Provider value={artifactCapability}>
      <AppWorkspaceChrome
        workspace={workspace}
        analysis={analysis}
        analysisSource={analysisSource}
        artifactLocationSnapshot={artifactLocationSnapshot}
        error={error}
        preloadLoading={preloadLoading}
        pendingRemoteRun={pendingRemoteRun}
        acceptingRemoteRun={acceptingRemoteRun}
        onManagedAnalysisLoaded={onManagedAnalysisLoaded}
        onError={onError}
        onAcceptPendingRemoteRun={onAcceptPendingRemoteRun}
        themePreference={themePreference}
        setPreferences={setPreferences}
        preferences={preferences}
        setThemePreference={setThemePreference}
        workspaceSignals={workspaceSignals}
      />
    </ArtifactCapabilityContext.Provider>
  );
}

export default function App(): ReactElement {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
