import type { KeyboardEvent } from 'react';
import type { UserArtifactSourceKind } from '../services/artifactSourceApi';
import { artifactLocationPlaceholder } from '../lib/artifactLoadPanelCopy';
import { Spinner } from './ui/Spinner';

export type ArtifactLoadPanelFormProps = {
  readinessRegionId: string;
  readinessLabel: string;
  sourceKind: UserArtifactSourceKind;
  onSourceKindChange: (kind: UserArtifactSourceKind) => void;
  location: string;
  onLocationChange: (value: string) => void;
  onLocationBlur: () => void;
  onLocationKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  candidateRunIds: string[];
  selectedRunId: string | null;
  onSelectRunId: (runId: string) => void;
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
  candidateRunIds,
  selectedRunId,
  onSelectRunId,
  discoverLoading,
  canLoad,
  loadLoading,
  loadWorkspaceHint,
  onLoadWorkspace,
}: ArtifactLoadPanelFormProps) {
  return (
    <div className="upload-panel">
      <div className="upload-panel__header">
        <div>
          <p className="eyebrow">Artifact source</p>
          <h3>Configure directory or prefix</h3>
        </div>
        <span id={readinessRegionId} className="upload-panel__status" role="status">
          {discoverLoading ? (
            <>
              <Spinner size={16} /> {readinessLabel}
            </>
          ) : (
            readinessLabel
          )}
        </span>
      </div>

      <div className="upload-panel__inputs artifact-load-panel__inputs">
        <div className="file-input-card">
          <label htmlFor="artifact-source-kind">Source type</label>
          <select
            id="artifact-source-kind"
            value={sourceKind}
            onChange={(e) => onSourceKindChange(e.target.value as UserArtifactSourceKind)}
          >
            <option value="local">Local directory</option>
            <option value="s3">Amazon S3</option>
            <option value="gcs">Google Cloud Storage</option>
          </select>
        </div>
        <div className="file-input-card">
          <label htmlFor="artifact-location-input">Location</label>
          <input
            id="artifact-location-input"
            type="text"
            autoComplete="off"
            placeholder={artifactLocationPlaceholder(sourceKind)}
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            onBlur={onLocationBlur}
            onKeyDown={onLocationKeyDown}
          />
        </div>
        {candidateRunIds.length > 0 ? (
          <fieldset className="file-input-card">
            <legend>
              Candidate sets
              {candidateRunIds.length > 1 ? ' — choose one before loading.' : null}
            </legend>
            {candidateRunIds.map((id) => (
              <label
                key={id}
                className="artifact-load-panel__radio-row"
                htmlFor={`artifact-run-${id}`}
              >
                <input
                  id={`artifact-run-${id}`}
                  type="radio"
                  name="artifact-run"
                  value={id}
                  checked={selectedRunId === id}
                  onChange={() => onSelectRunId(id)}
                />
                <span>{id}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
      </div>

      <div className="upload-panel__tips">
        <div>
          <strong>Local paths</strong>
          <span>
            Resolved on the machine running the dev server or <code>dbt-tools-web</code>, not in
            your browser.
          </span>
        </div>
        <div>
          <strong>S3 and GCS</strong>
          <span>
            Use default SDK credential chains on the server. UI never receives cloud keys.
          </span>
        </div>
      </div>

      <div className="artifact-load-panel__actions artifact-load-panel__actions--load-only">
        <button
          type="button"
          className="primary-action"
          disabled={!canLoad || candidateRunIds.length === 0 || loadLoading}
          aria-busy={loadLoading}
          aria-describedby={readinessRegionId}
          title={loadWorkspaceHint ?? undefined}
          onClick={() => {
            onLoadWorkspace();
          }}
        >
          {loadLoading ? (
            <>
              <Spinner size={16} /> Loading…
            </>
          ) : (
            'Load workspace'
          )}
        </button>
      </div>
    </div>
  );
}
