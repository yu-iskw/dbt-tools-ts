import type { AnalysisState } from '@web/types';
import { sourceLabel } from '@web/lib/artifactSource';
import type { WorkspaceArtifactSource } from '@web/services/artifactSourceApi';
import type { WorkspaceView } from '../AnalysisWorkspace';
import { AppLogo } from './AppLogo';
import {
  type NavigationSelectionTarget,
  isNavigationTargetActive,
  navigationItems,
} from './appNavigation';
import { NavIcon } from './NavIcon';

const WAITING_FOR_ARTIFACTS = 'Waiting for artifacts';

export function AppSidebar({
  activeView,
  setNavigationTarget,
  sidebarCollapsed,
  setSidebarCollapsed,
  onNavigate,
  analysis,
  analysisSource,
}: {
  activeView: WorkspaceView;
  setNavigationTarget: (target: NavigationSelectionTarget) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (fn: (c: boolean) => boolean) => void;
  onNavigate: () => void;
  analysis: AnalysisState | null;
  analysisSource: WorkspaceArtifactSource | null;
}) {
  const sourceText = sourceLabel(analysisSource);

  return (
    <aside
      id="app-sidebar"
      className={`app-sidebar${sidebarCollapsed ? ' app-sidebar--collapsed' : ''}`}
    >
      <button
        type="button"
        className="app-sidebar__brand-link"
        onClick={() => {
          setNavigationTarget({ view: 'health' });
          onNavigate();
        }}
        title="Go to Health"
      >
        <AppLogo className="app-logo app-logo--brand" />
        {!sidebarCollapsed && (
          <div>
            <strong>dbt-tools</strong>
            <span>Artifact operations console</span>
          </div>
        )}
      </button>

      <nav className="app-sidebar__nav" aria-label="Workspace sections">
        <div className="nav-group">
          {navigationItems.map((item) => {
            const disabled = !analysis;
            const active = isNavigationTargetActive(item, activeView);
            return (
              <button
                key={item.id}
                type="button"
                className={active ? 'sidebar-link sidebar-link--active' : 'sidebar-link'}
                disabled={disabled}
                onClick={() => {
                  setNavigationTarget(item);
                  onNavigate();
                }}
                aria-label={item.label}
                title={item.label}
              >
                <span className="sidebar-link__icon">
                  <NavIcon id={item.id} />
                </span>
                <div className="sidebar-link__body">
                  <strong>{item.label}</strong>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setSidebarCollapsed((c) => !c)}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? '›' : '‹'}
      </button>

      <div className="app-sidebar__footer">
        <button
          type="button"
          className={
            activeView === 'settings'
              ? 'sidebar-link sidebar-link--active sidebar-settings-trigger'
              : 'sidebar-link sidebar-settings-trigger'
          }
          onClick={() => {
            setNavigationTarget({ view: 'settings' });
            onNavigate();
          }}
          aria-current={activeView === 'settings' ? 'page' : undefined}
          aria-label="Open settings"
          title="Settings"
        >
          <span className="sidebar-link__icon">
            <NavIcon id="settings" />
          </span>
          {!sidebarCollapsed && (
            <div className="sidebar-link__body">
              <strong>Settings</strong>
            </div>
          )}
        </button>

        {!sidebarCollapsed && (
          <>
            <div className="sidebar-settings-divider" />
            <div className="app-sidebar__session">
              <p className="eyebrow">Session</p>
              <strong>{sourceText}</strong>
              <span>
                {analysis
                  ? `${analysis.summary.total_nodes} executions analyzed`
                  : WAITING_FOR_ARTIFACTS}
              </span>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
