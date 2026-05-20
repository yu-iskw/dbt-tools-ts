import { sourceLabel, userArtifactSourceKindLabel } from '@web/lib/artifact-source';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
  type ReactElement,
} from 'react';

import { SectionCard, WorkspaceScaffold } from '../AnalysisWorkspace/shared';
import { ArtifactLoadPanel } from '../ArtifactLoadPanel';

import type { WorkspacePreferences } from '@web/hooks/use-workspace-preferences';
import type { ThemePreference } from '@web/lib/analysis-workspace/types';
import type { ArtifactLocationSnapshot } from '@web/lib/artifact-source';
import type { AnalysisLoadResult } from '@web/services/analysis-loader';
import type {
  MissingOptionalArtifactsState,
  RemoteArtifactRun,
  WorkspaceArtifactSource,
} from '@web/services/artifact-source-api';

const ACTIVE_PILL_CLASS = 'workspace-pill workspace-pill--active';
const INACTIVE_PILL_CLASS = 'workspace-pill';

function pillClass(active: boolean) {
  return active ? ACTIVE_PILL_CLASS : INACTIVE_PILL_CLASS;
}

function ChangeArtifactLocationModal({
  open,
  onClose,
  returnFocusRef,
  onManagedAnalysisLoaded,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onManagedAnalysisLoaded: (
    result: AnalysisLoadResult,
    source: 'preload' | 'remote',
    optionalArtifacts: MissingOptionalArtifactsState,
  ) => void;
  onError: (message: string | null) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        returnFocusRef.current?.focus();
      }
      wasOpenRef.current = false;
      return;
    }
    wasOpenRef.current = true;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, returnFocusRef]);

  if (!open) return null;

  return (
    <div className="settings-artifact-dialog" aria-hidden={false}>
      <button
        type="button"
        className="settings-artifact-dialog__backdrop"
        aria-label="Close change location dialog"
        onClick={() => {
          onError(null);
          onClose();
        }}
      />
      <div
        ref={panelRef}
        className="settings-artifact-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-artifact-dialog-title"
        tabIndex={-1}
      >
        <header className="settings-artifact-dialog__header">
          <div>
            <p className="eyebrow">Artifacts</p>
            <h2 id="settings-artifact-dialog-title">Change artifact location</h2>
            <p className="settings-artifact-dialog__lede">
              Use the same directory or cloud prefix flow as the main workspace load screen.
              Credentials stay on the server.
            </p>
          </div>
          <button
            type="button"
            className="settings-artifact-dialog__close"
            aria-label="Close"
            onClick={() => {
              onError(null);
              onClose();
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="settings-artifact-dialog__body">
          <ArtifactLoadPanel onManagedLoad={onManagedAnalysisLoaded} onError={onError} />
        </div>
      </div>
    </div>
  );
}

function SettingsHero({
  analysisSource,
  executionCount,
}: {
  analysisSource: WorkspaceArtifactSource | null;
  executionCount: number | null;
}) {
  return (
    <section className="settings-hero" aria-label="Workspace preferences">
      <p className="eyebrow">Workspace profile</p>
      <h3>Configure how this console looks and behaves by default.</h3>
      <p>
        Changes save locally and apply to the current workspace immediately when the relevant view
        is open.
      </p>
      <div className="settings-chip-row">
        <span className="app-badge">{sourceLabel(analysisSource)}</span>
        <span className="settings-chip">
          {executionCount != null ? `${executionCount} executions loaded` : 'No artifacts loaded'}
        </span>
      </div>
    </section>
  );
}

function AppearanceSettings({
  themePreference,
  onThemeChange,
}: {
  themePreference: ThemePreference;
  onThemeChange: (value: ThemePreference) => void;
}) {
  return (
    <SectionCard
      title="Appearance"
      subtitle="Choose how the workspace chrome should render by default."
    >
      <div className="settings-field-group">
        <span className="settings-field-label">Theme</span>
        <div className="settings-segmented">
          {(['system', 'light', 'dark'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={pillClass(themePreference === value)}
              onClick={() => onThemeChange(value)}
            >
              {value === 'system' ? 'System' : value.charAt(0).toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

function SessionSettings({
  analysisSource,
  executionCount,
  artifactLocationSnapshot,
  onOpenChangeLocation,
  changeLocationTriggerRef,
  pendingRemoteRun,
  acceptingRemoteRun,
  onAcceptPendingRemoteRun,
}: {
  analysisSource: WorkspaceArtifactSource | null;
  executionCount: number | null;
  artifactLocationSnapshot: ArtifactLocationSnapshot | null;
  onOpenChangeLocation: () => void;
  changeLocationTriggerRef: RefObject<HTMLButtonElement | null>;
  pendingRemoteRun: RemoteArtifactRun | null;
  acceptingRemoteRun: boolean;
  onAcceptPendingRemoteRun: () => Promise<void>;
}) {
  const kindLabel = userArtifactSourceKindLabel(artifactLocationSnapshot?.sourceKind);
  const pathLine =
    artifactLocationSnapshot?.locationDisplay != null &&
    artifactLocationSnapshot.locationDisplay.trim() !== ''
      ? artifactLocationSnapshot.locationDisplay
      : null;

  return (
    <SectionCard title="Session" subtitle="Current artifact source and data-loading controls.">
      <div className="settings-stack">
        <div className="settings-readout">
          <span className="settings-field-label">Current source</span>
          <strong>{sourceLabel(analysisSource)}</strong>
          <p>
            {executionCount != null
              ? `${executionCount} executions are available in this session.`
              : 'Load artifacts to unlock analysis views.'}
          </p>
        </div>
        <div className="settings-readout">
          <span className="settings-field-label">Configured location</span>
          {pathLine != null ? (
            <>
              {kindLabel != null ? <strong>{kindLabel}</strong> : null}
              <p className="settings-mono-path settings-session__path" title={pathLine}>
                {pathLine}
              </p>
            </>
          ) : kindLabel != null ? (
            <>
              <strong>{kindLabel}</strong>
              <p className="settings-readout-muted">
                Path label was not returned for this session.
              </p>
            </>
          ) : (
            <p className="settings-readout-muted">
              Nothing configured yet. Use Change location… to open the load wizard and point this
              session at a directory or cloud prefix.
            </p>
          )}
        </div>
        <div className="settings-session__actions">
          <button
            ref={changeLocationTriggerRef}
            type="button"
            className="primary-action settings-primary-action"
            onClick={onOpenChangeLocation}
          >
            Change location…
          </button>
        </div>
        {pendingRemoteRun && (
          <button
            type="button"
            className="workspace-pill"
            onClick={() => void onAcceptPendingRemoteRun()}
            disabled={acceptingRemoteRun}
          >
            {acceptingRemoteRun ? 'Switching…' : `Load ${pendingRemoteRun.label}`}
          </button>
        )}
      </div>
    </SectionCard>
  );
}

function ShellDefaultsSettings({
  preferences,
  setPreferences,
}: {
  preferences: WorkspacePreferences;
  setPreferences: Dispatch<SetStateAction<WorkspacePreferences>>;
}) {
  return (
    <SectionCard
      title="Shell Defaults"
      subtitle="Control the default shape of the workspace chrome."
    >
      <div className="settings-field-group">
        <span className="settings-field-label">Sidebar</span>
        <div className="settings-segmented">
          <button
            type="button"
            className={pillClass(!preferences.sidebarCollapsedDefault)}
            onClick={() =>
              setPreferences((current) => ({
                ...current,
                sidebarCollapsedDefault: false,
              }))
            }
          >
            Expanded
          </button>
          <button
            type="button"
            className={pillClass(preferences.sidebarCollapsedDefault)}
            onClick={() =>
              setPreferences((current) => ({
                ...current,
                sidebarCollapsedDefault: true,
              }))
            }
          >
            Collapsed
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

function TimelineDefaultsSettings({
  preferences,
  setPreferences,
}: {
  preferences: WorkspacePreferences;
  setPreferences: Dispatch<SetStateAction<WorkspacePreferences>>;
}) {
  return (
    <SectionCard
      title="Timeline Defaults"
      subtitle="Set the default execution timeline filters and dependency focus."
    >
      <div className="settings-stack">
        <div className="settings-inline-grid">
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={preferences.timelineDefaults.showTests}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  timelineDefaults: {
                    ...current.timelineDefaults,
                    showTests: event.target.checked,
                  },
                }))
              }
            />
            <span>Show tests by default</span>
          </label>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={preferences.timelineDefaults.failuresOnly}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  timelineDefaults: {
                    ...current.timelineDefaults,
                    failuresOnly: event.target.checked,
                  },
                }))
              }
            />
            <span>Start with failures-only emphasis</span>
          </label>
        </div>
        <div className="settings-inline-grid">
          <label className="settings-field">
            <span className="settings-field-label">Dependency direction</span>
            <select
              value={preferences.timelineDefaults.dependencyDirection}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  timelineDefaults: {
                    ...current.timelineDefaults,
                    dependencyDirection: event.target
                      .value as WorkspacePreferences['timelineDefaults']['dependencyDirection'],
                  },
                }))
              }
            >
              <option value="upstream">Upstream</option>
              <option value="both">Both</option>
              <option value="downstream">Downstream</option>
            </select>
          </label>
          <label className="settings-field">
            <span className="settings-field-label">Dependency depth</span>
            <input
              type="number"
              min="1"
              max="10"
              value={preferences.timelineDefaults.dependencyDepthHops}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  timelineDefaults: {
                    ...current.timelineDefaults,
                    dependencyDepthHops: Math.max(1, Math.min(10, Number(event.target.value) || 1)),
                  },
                }))
              }
            />
          </label>
        </div>
      </div>
    </SectionCard>
  );
}

function InventoryDefaultsSettings({
  preferences,
  setPreferences,
}: {
  preferences: WorkspacePreferences;
  setPreferences: Dispatch<SetStateAction<WorkspacePreferences>>;
}) {
  return (
    <SectionCard
      title="Inventory Defaults"
      subtitle="Choose how asset exploration and lineage open by default."
    >
      <div className="settings-stack">
        <div className="settings-inline-grid">
          <label className="settings-field">
            <span className="settings-field-label">Explorer mode</span>
            <select
              value={preferences.inventoryDefaults.explorerMode}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  inventoryDefaults: {
                    ...current.inventoryDefaults,
                    explorerMode: event.target
                      .value as WorkspacePreferences['inventoryDefaults']['explorerMode'],
                  },
                }))
              }
            >
              <option value="project">Project</option>
              <option value="database">Database</option>
            </select>
          </label>
          <label className="settings-field">
            <span className="settings-field-label">Lineage lens</span>
            <select
              value={preferences.inventoryDefaults.lineageLensMode}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  inventoryDefaults: {
                    ...current.inventoryDefaults,
                    lineageLensMode: event.target
                      .value as WorkspacePreferences['inventoryDefaults']['lineageLensMode'],
                  },
                }))
              }
            >
              <option value="type">Type</option>
              <option value="status">Status</option>
              <option value="coverage">Coverage</option>
            </select>
          </label>
        </div>
        <div className="settings-inline-grid">
          <label className="settings-field">
            <span className="settings-field-label">Upstream depth</span>
            <input
              type="number"
              min="1"
              max="10"
              value={preferences.inventoryDefaults.lineageUpstreamDepth}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  inventoryDefaults: {
                    ...current.inventoryDefaults,
                    lineageUpstreamDepth: Math.max(
                      1,
                      Math.min(10, Number(event.target.value) || 1),
                    ),
                  },
                }))
              }
            />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">Downstream depth</span>
            <input
              type="number"
              min="1"
              max="10"
              value={preferences.inventoryDefaults.lineageDownstreamDepth}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  inventoryDefaults: {
                    ...current.inventoryDefaults,
                    lineageDownstreamDepth: Math.max(
                      1,
                      Math.min(10, Number(event.target.value) || 1),
                    ),
                  },
                }))
              }
            />
          </label>
        </div>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={preferences.inventoryDefaults.allDepsMode}
            onChange={(event) =>
              setPreferences((current) => ({
                ...current,
                inventoryDefaults: {
                  ...current.inventoryDefaults,
                  allDepsMode: event.target.checked,
                },
              }))
            }
          />
          <span>Open lineage with all dependencies expanded</span>
        </label>
      </div>
    </SectionCard>
  );
}

export function SettingsView({
  preferences,
  setPreferences,
  themePreference,
  setThemePreference,
  analysisSource,
  artifactLocationSnapshot,
  executionCount,
  onManagedAnalysisLoaded,
  onError,
  pendingRemoteRun,
  acceptingRemoteRun,
  onAcceptPendingRemoteRun,
}: {
  preferences: WorkspacePreferences;
  setPreferences: Dispatch<SetStateAction<WorkspacePreferences>>;
  themePreference: ThemePreference;
  setThemePreference: Dispatch<SetStateAction<ThemePreference>>;
  analysisSource: WorkspaceArtifactSource | null;
  artifactLocationSnapshot: ArtifactLocationSnapshot | null;
  executionCount: number | null;
  onManagedAnalysisLoaded: (
    result: AnalysisLoadResult,
    source: 'preload' | 'remote',
    optionalArtifacts: MissingOptionalArtifactsState,
  ) => void;
  onError: (message: string | null) => void;
  pendingRemoteRun: RemoteArtifactRun | null;
  acceptingRemoteRun: boolean;
  onAcceptPendingRemoteRun: () => Promise<void>;
}): ReactElement {
  const [changeLocationOpen, setChangeLocationOpen] = useState(false);
  const changeLocationTriggerRef = useRef<HTMLButtonElement>(null);

  const handleManagedFromModal = useCallback(
    (
      result: AnalysisLoadResult,
      source: 'preload' | 'remote',
      optionalArtifacts: MissingOptionalArtifactsState,
    ) => {
      setChangeLocationOpen(false);
      onManagedAnalysisLoaded(result, source, optionalArtifacts);
    },
    [onManagedAnalysisLoaded],
  );

  const updateThemePreference = (value: ThemePreference) => {
    setThemePreference(value);
    setPreferences((current) => ({ ...current, theme: value }));
  };

  return (
    <WorkspaceScaffold
      title="Settings"
      description="Workspace defaults, visual preferences, and session controls."
      className="settings-view"
    >
      <ChangeArtifactLocationModal
        open={changeLocationOpen}
        onClose={() => {
          onError(null);
          setChangeLocationOpen(false);
        }}
        returnFocusRef={changeLocationTriggerRef}
        onManagedAnalysisLoaded={handleManagedFromModal}
        onError={onError}
      />
      <div className="settings-grid">
        <SettingsHero analysisSource={analysisSource} executionCount={executionCount} />
        <AppearanceSettings
          themePreference={themePreference}
          onThemeChange={updateThemePreference}
        />
        <SessionSettings
          analysisSource={analysisSource}
          executionCount={executionCount}
          artifactLocationSnapshot={artifactLocationSnapshot}
          onOpenChangeLocation={() => setChangeLocationOpen(true)}
          changeLocationTriggerRef={changeLocationTriggerRef}
          pendingRemoteRun={pendingRemoteRun}
          acceptingRemoteRun={acceptingRemoteRun}
          onAcceptPendingRemoteRun={onAcceptPendingRemoteRun}
        />
        <ShellDefaultsSettings preferences={preferences} setPreferences={setPreferences} />
        <TimelineDefaultsSettings preferences={preferences} setPreferences={setPreferences} />
        <InventoryDefaultsSettings preferences={preferences} setPreferences={setPreferences} />
      </div>
    </WorkspaceScaffold>
  );
}
