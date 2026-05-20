import {
  artifactLocationHelper,
  artifactLocationPlaceholder,
} from '../lib/artifact-load-panel-copy';

import { Spinner } from './ui/Spinner';

import type { UserArtifactSourceKind } from '../services/artifact-source-api';
import type { ReactElement, KeyboardEvent } from 'react';

const SOURCE_TABS: { value: UserArtifactSourceKind; label: string }[] = [
  { value: 'local', label: 'Local directory' },
  { value: 's3', label: 'Amazon S3' },
  { value: 'gcs', label: 'Google Cloud Storage' },
];

function segmentedTabClass(active: boolean): string {
  return active
    ? 'workspace-segmented-control__button workspace-segmented-control__button--active'
    : 'workspace-segmented-control__button';
}

export type ArtifactLoadPanelFormProps = {
  readinessRegionId: string;
  readinessLabel: string;
  sourceKind: UserArtifactSourceKind;
  onSourceKindChange: (kind: UserArtifactSourceKind) => void;
  location: string;
  onLocationChange: (value: string) => void;
  onLocationBlur: () => void;
  onLocationKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  impersonatedServiceAccount: string;
  onImpersonatedServiceAccountChange: (value: string) => void;
  onImpersonatedServiceAccountBlur?: () => void;
  discoveryError: string | null;
  onScan: () => void;
  discoverLoading: boolean;
  canLoad: boolean;
  loadLoading: boolean;
  loadWorkspaceHint: string | undefined;
  onLoadWorkspace: () => void;
};

export function ArtifactLoadPanelForm({
  readinessRegionId,
  readinessLabel,
  sourceKind,
  onSourceKindChange,
  location,
  onLocationChange,
  onLocationBlur,
  onLocationKeyDown,
  impersonatedServiceAccount,
  onImpersonatedServiceAccountChange,
  onImpersonatedServiceAccountBlur,
  discoveryError,
  onScan,
  discoverLoading,
  canLoad,
  loadLoading,
  loadWorkspaceHint,
  onLoadWorkspace,
}: ArtifactLoadPanelFormProps): ReactElement {
  const describedByIds = [
    'artifact-location-helper',
    discoveryError != null ? 'artifact-location-error' : undefined,
    readinessRegionId,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="upload-panel">
      <header className="upload-panel__header">
        <p className="eyebrow">Artifact source</p>
        <h3>Artifact location</h3>
        <p className="upload-panel__lede">
          Folder or prefix with <code>manifest.json</code> and <code>run_results.json</code> at the
          root.
        </p>
      </header>

      <div className="upload-panel__body artifact-load-panel__inputs">
        <div className="upload-panel__field">
          <span className="upload-panel__label" id="artifact-source-kind-label">
            Connection
          </span>
          <div
            className="workspace-segmented-control"
            role="tablist"
            aria-labelledby="artifact-source-kind-label"
          >
            {SOURCE_TABS.map((tab) => {
              const active = sourceKind === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  id={`artifact-source-tab-${tab.value}`}
                  aria-selected={active}
                  className={segmentedTabClass(active)}
                  onClick={() => onSourceKindChange(tab.value)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="upload-panel__field">
          <label className="upload-panel__label" htmlFor="artifact-location-input">
            Location
          </label>
          <div className="upload-panel__location-row">
            <input
              id="artifact-location-input"
              type="text"
              autoComplete="off"
              aria-invalid={discoveryError != null}
              aria-describedby={describedByIds}
              placeholder={artifactLocationPlaceholder(sourceKind)}
              value={location}
              onChange={(e) => onLocationChange(e.target.value)}
              onBlur={onLocationBlur}
              onKeyDown={onLocationKeyDown}
            />
            <button
              type="button"
              className="secondary-action"
              disabled={discoverLoading || location.trim() === ''}
              aria-busy={discoverLoading}
              onClick={onScan}
            >
              {discoverLoading ? (
                <>
                  <Spinner size={16} /> Scanning…
                </>
              ) : (
                'Scan location'
              )}
            </button>
          </div>
          <p id="artifact-location-helper" className="upload-panel__helper">
            {artifactLocationHelper(sourceKind)}
          </p>
          {discoveryError != null ? (
            <p id="artifact-location-error" className="upload-panel__error" role="alert">
              {discoveryError}
            </p>
          ) : null}
        </div>

        {sourceKind === 'gcs' ? (
          <div className="upload-panel__field">
            <label
              className="upload-panel__label"
              htmlFor="artifact-gcs-impersonated-service-account"
            >
              Impersonated service account
            </label>
            <input
              id="artifact-gcs-impersonated-service-account"
              type="text"
              autoComplete="off"
              placeholder="target-sa@project.iam.gserviceaccount.com"
              value={impersonatedServiceAccount}
              onChange={(e) => onImpersonatedServiceAccountChange(e.target.value)}
              onBlur={() => {
                onImpersonatedServiceAccountBlur?.();
              }}
            />
            <p className="upload-panel__helper">
              Optional. Uses server-side Google credentials to impersonate this service account for
              GCS access. After editing, leave this field or run Scan location (or press Enter in
              Location).
            </p>
          </div>
        ) : null}
      </div>

      <footer className="upload-panel__footer">
        <span id={readinessRegionId} className="upload-panel__footer-status" role="status">
          {discoverLoading ? (
            <>
              <Spinner size={16} /> {readinessLabel}
            </>
          ) : (
            readinessLabel
          )}
        </span>
        <button
          type="button"
          className="primary-action"
          disabled={!canLoad || loadLoading}
          aria-busy={loadLoading}
          aria-describedby={readinessRegionId}
          title={loadWorkspaceHint ?? undefined}
          onClick={onLoadWorkspace}
        >
          {loadLoading ? (
            <>
              <Spinner size={16} /> Loading…
            </>
          ) : (
            'Load workspace'
          )}
        </button>
      </footer>
    </div>
  );
}
