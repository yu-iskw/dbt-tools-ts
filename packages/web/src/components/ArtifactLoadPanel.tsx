import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { useToast } from './ui/Toast';
import {
  configureArtifactSourceFromApi,
  discoverArtifactSourceFromApi,
  refetchFromApi,
  type GcsProviderOptions,
  type MissingOptionalArtifactsState,
  type UserArtifactSourceKind,
} from '../services/artifactSourceApi';
import type { AnalysisLoadResult } from '../services/analysisLoader';
import {
  getArtifactLoadWorkspaceHint,
  getArtifactReadinessLabel,
} from '../lib/artifactLoadPanelCopy';
import { ArtifactLoadPanelForm } from './ArtifactLoadPanelForm';
import { ArtifactLoadPanelHero } from './ArtifactLoadPanelHero';

export interface ArtifactLoadPanelProps {
  onManagedLoad: (
    result: AnalysisLoadResult,
    source: 'preload' | 'remote',
    optionalArtifacts: MissingOptionalArtifactsState,
  ) => void;
  onError: (message: string | null) => void;
}

function buildGcsOptions(kind: UserArtifactSourceKind, sa: string): GcsProviderOptions | undefined {
  if (kind !== 'gcs') return undefined;
  const trimmed = sa.trim();
  return trimmed !== '' ? { impersonatedServiceAccount: trimmed } : undefined;
}

export function ArtifactLoadPanel({ onManagedLoad, onError }: ArtifactLoadPanelProps) {
  const { toast } = useToast();
  const readinessRegionId = useId();
  const [sourceKind, setSourceKind] = useState<UserArtifactSourceKind>('local');
  const [location, setLocation] = useState('');
  const [impersonatedServiceAccount, setImpersonatedServiceAccount] = useState('');
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [loadLoading, setLoadLoading] = useState(false);
  const [candidateRunIds, setCandidateRunIds] = useState<string[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const locationRef = useRef(location);
  const sourceKindRef = useRef(sourceKind);
  const impersonatedServiceAccountRef = useRef(impersonatedServiceAccount);
  locationRef.current = location;
  sourceKindRef.current = sourceKind;
  impersonatedServiceAccountRef.current = impersonatedServiceAccount;

  const discoverySeqRef = useRef(0);
  const lastScanKeyRef = useRef('');

  const readinessInput = useMemo(
    () => ({
      discoverLoading,
      discoveryError,
      candidateRunIds,
      selectedRunId,
      location,
    }),
    [candidateRunIds, discoverLoading, discoveryError, location, selectedRunId],
  );

  const readinessLabel = useMemo(() => getArtifactReadinessLabel(readinessInput), [readinessInput]);

  const canLoad =
    candidateRunIds.length > 0 &&
    selectedRunId != null &&
    selectedRunId.trim() !== '' &&
    !loadLoading &&
    discoveryError == null;

  const loadWorkspaceHint = useMemo(
    () =>
      getArtifactLoadWorkspaceHint({
        ...readinessInput,
        loadLoading,
        canLoad,
      }),
    [canLoad, loadLoading, readinessInput],
  );

  const loadWorkspaceForRunId = useCallback(
    async (runId: string) => {
      if (runId.trim() === '') {
        onError('Select a candidate artifact set.');
        return;
      }
      setLoadLoading(true);
      onError(null);
      try {
        const options = buildGcsOptions(
          sourceKindRef.current,
          impersonatedServiceAccountRef.current,
        );
        const status = await configureArtifactSourceFromApi(
          sourceKindRef.current,
          locationRef.current.trim(),
          runId,
          options,
        );
        const source = status.currentSource;
        if (source !== 'preload' && source !== 'remote') {
          onError('Artifacts are not ready to load.');
          return;
        }
        const caps: MissingOptionalArtifactsState = status.missingOptionalArtifacts ?? {
          missingCatalog: false,
          missingSources: false,
        };
        if (caps.missingCatalog || caps.missingSources) {
          const parts: string[] = [];
          if (caps.missingCatalog) parts.push('catalog.json');
          if (caps.missingSources) parts.push('sources.json');
          toast(
            `Optional artifacts not loaded: ${parts.join(', ')}. Related inventory panels may be limited.`,
            'positive',
          );
        }
        const result = await refetchFromApi(source);
        if (result == null) {
          onError('Could not read artifact bytes from the server.');
          return;
        }
        onManagedLoad(result, source, caps);
        setImpersonatedServiceAccount('');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load artifacts.';
        onError(message);
        toast(message, 'danger');
      } finally {
        setLoadLoading(false);
      }
    },
    [onError, onManagedLoad, toast],
  );

  const runDiscovery = useCallback(
    async (force?: boolean) => {
      const kind = sourceKindRef.current;
      const loc = locationRef.current.trim();
      const sa = impersonatedServiceAccountRef.current.trim();
      const scanKey = `${kind}|${loc}|${sa}`;
      if (loc === '') {
        onError('Enter a directory or bucket prefix.');
        return;
      }
      if (!force && scanKey === lastScanKeyRef.current) {
        return;
      }
      const seq = ++discoverySeqRef.current;
      setDiscoverLoading(true);
      onError(null);
      setDiscoveryError(null);
      setCandidateRunIds([]);
      setSelectedRunId(null);
      try {
        const options = buildGcsOptions(kind, sa);
        const discovery = await discoverArtifactSourceFromApi(kind, loc, options);
        if (seq !== discoverySeqRef.current) {
          return;
        }
        if (discovery.discoveryError != null) {
          setDiscoveryError(discovery.discoveryError);
          onError(discovery.discoveryError);
          return;
        }
        const ids = discovery.candidates?.map((c) => c.runId) ?? [];
        const needsSel = discovery.needsSelection === true;
        setCandidateRunIds(ids);
        if (ids.length === 1) {
          setSelectedRunId(ids[0]!);
        } else if (ids.length > 1) {
          setSelectedRunId(null);
        }
        lastScanKeyRef.current = scanKey;
        if (ids.length === 1 && !needsSel) {
          await loadWorkspaceForRunId(ids[0]!);
        }
      } catch (err) {
        if (seq !== discoverySeqRef.current) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Discovery failed.';
        setDiscoveryError(message);
        onError(message);
      } finally {
        if (seq === discoverySeqRef.current) {
          setDiscoverLoading(false);
        }
      }
    },
    [loadWorkspaceForRunId, onError],
  );

  async function handleLoad() {
    if (selectedRunId == null || selectedRunId.trim() === '') {
      onError('Select a candidate artifact set.');
      return;
    }
    await loadWorkspaceForRunId(selectedRunId);
  }

  return (
    <section className="upload-hero">
      <ArtifactLoadPanelHero />
      <ArtifactLoadPanelForm
        readinessRegionId={readinessRegionId}
        readinessLabel={readinessLabel}
        sourceKind={sourceKind}
        onSourceKindChange={(nextKind) => {
          setSourceKind(nextKind);
          setCandidateRunIds([]);
          setSelectedRunId(null);
          setDiscoveryError(null);
          lastScanKeyRef.current = '';
          onError(null);
        }}
        location={location}
        onLocationChange={setLocation}
        impersonatedServiceAccount={impersonatedServiceAccount}
        onImpersonatedServiceAccountChange={setImpersonatedServiceAccount}
        onLocationBlur={() => {
          if (locationRef.current.trim() === '') {
            return;
          }
          void runDiscovery(false);
        }}
        onLocationKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void runDiscovery(false);
          }
        }}
        candidateRunIds={candidateRunIds}
        selectedRunId={selectedRunId}
        onSelectRunId={setSelectedRunId}
        discoverLoading={discoverLoading}
        canLoad={canLoad}
        loadLoading={loadLoading}
        loadWorkspaceHint={loadWorkspaceHint}
        onLoadWorkspace={() => {
          void handleLoad();
        }}
      />
    </section>
  );
}
