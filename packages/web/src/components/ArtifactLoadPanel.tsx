import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { useToast } from './ui/Toast';
import {
  configureArtifactSourceFromApi,
  discoverArtifactSourceFromApi,
  refetchFromApi,
  type GcsArtifactSourceClientOptions,
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

function gcsClientOptionsFromRefs(
  kind: UserArtifactSourceKind,
  impersonatedServiceAccountRaw: string,
): GcsArtifactSourceClientOptions | undefined {
  if (kind !== 'gcs') return undefined;
  return { impersonatedServiceAccount: impersonatedServiceAccountRaw };
}

function gcsDiscoveryMismatchMessage(
  kind: UserArtifactSourceKind,
  locationTrimmed: string,
  impersonationTrimmed: string,
  lastScanKey: string,
): string | null {
  if (kind !== 'gcs' || locationTrimmed === '') {
    return null;
  }
  const scanKey = `gcs|${locationTrimmed}|${impersonationTrimmed}`;
  if (scanKey === lastScanKey) {
    return null;
  }
  return 'Run artifact discovery again after changing the GCS location or impersonated service account.';
}

function gcsLoadPrecheckMessage(
  kind: UserArtifactSourceKind,
  locationTrimmed: string,
  impersonationTrimmed: string,
  lastScanKey: string,
  discoveryInFlight: boolean,
): string | null {
  if (kind !== 'gcs' || locationTrimmed === '') {
    return null;
  }
  if (discoveryInFlight) {
    return 'Wait for artifact discovery to finish, then try loading again.';
  }
  return gcsDiscoveryMismatchMessage(kind, locationTrimmed, impersonationTrimmed, lastScanKey);
}

export interface ArtifactLoadPanelProps {
  onManagedLoad: (
    result: AnalysisLoadResult,
    source: 'preload' | 'remote',
    optionalArtifacts: MissingOptionalArtifactsState,
  ) => void;
  onError: (message: string | null) => void;
}

export function ArtifactLoadPanel({ onManagedLoad, onError }: ArtifactLoadPanelProps) {
  const { toast } = useToast();
  const readinessRegionId = useId();
  const [sourceKind, setSourceKind] = useState<UserArtifactSourceKind>('local');
  const [location, setLocation] = useState('');
  const [impersonatedServiceAccount, setImpersonatedServiceAccount] = useState('');
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [loadLoading, setLoadLoading] = useState(false);
  const [scanSucceeded, setScanSucceeded] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const locationRef = useRef(location);
  const sourceKindRef = useRef(sourceKind);
  const impersonatedServiceAccountRef = useRef(impersonatedServiceAccount);
  locationRef.current = location;
  sourceKindRef.current = sourceKind;
  impersonatedServiceAccountRef.current = impersonatedServiceAccount;

  const discoverySeqRef = useRef(0);
  const lastScanKeyRef = useRef('');
  const discoveryInFlightRef = useRef(false);

  const readinessInput = useMemo(
    () => ({
      discoverLoading,
      discoveryError,
      scanSucceeded,
      location,
    }),
    [discoverLoading, discoveryError, location, scanSucceeded],
  );

  const readinessLabel = useMemo(() => getArtifactReadinessLabel(readinessInput), [readinessInput]);

  const canLoad = scanSucceeded && !loadLoading && !discoverLoading && discoveryError == null;

  const loadWorkspaceHint = useMemo(
    () =>
      getArtifactLoadWorkspaceHint({
        ...readinessInput,
        loadLoading,
        canLoad,
      }),
    [canLoad, loadLoading, readinessInput],
  );

  const loadWorkspace = useCallback(async () => {
    const kind = sourceKindRef.current;
    const loc = locationRef.current.trim();
    const precheck = gcsLoadPrecheckMessage(
      kind,
      loc,
      impersonatedServiceAccountRef.current.trim(),
      lastScanKeyRef.current,
      discoveryInFlightRef.current,
    );
    if (precheck != null) {
      onError(precheck);
      return;
    }
    setLoadLoading(true);
    onError(null);
    try {
      const status = await configureArtifactSourceFromApi(
        sourceKindRef.current,
        locationRef.current.trim(),
        undefined,
        gcsClientOptionsFromRefs(sourceKindRef.current, impersonatedServiceAccountRef.current),
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
      if (sourceKindRef.current === 'gcs') {
        lastScanKeyRef.current = '';
        setScanSucceeded(false);
      }
      setImpersonatedServiceAccount('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load artifacts.';
      onError(message);
      toast(message, 'danger');
    } finally {
      setLoadLoading(false);
    }
  }, [onError, onManagedLoad, toast]);

  const runDiscovery = useCallback(
    async (force?: boolean) => {
      const kind = sourceKindRef.current;
      const loc = locationRef.current.trim();
      const impersonationTrimmed =
        kind === 'gcs' ? impersonatedServiceAccountRef.current.trim() : '';
      const scanKey = kind === 'gcs' ? `${kind}|${loc}|${impersonationTrimmed}` : `${kind}|${loc}`;
      if (loc === '') {
        onError('Enter a directory or bucket prefix.');
        return;
      }
      if (!force && scanKey === lastScanKeyRef.current) {
        return;
      }
      const seq = ++discoverySeqRef.current;
      discoveryInFlightRef.current = true;
      setDiscoverLoading(true);
      onError(null);
      setDiscoveryError(null);
      setScanSucceeded(false);
      try {
        const discovery = await discoverArtifactSourceFromApi(
          kind,
          loc,
          gcsClientOptionsFromRefs(kind, impersonatedServiceAccountRef.current),
        );
        if (seq !== discoverySeqRef.current) {
          return;
        }
        if (discovery.discoveryError != null) {
          setDiscoveryError(discovery.discoveryError);
          onError(discovery.discoveryError);
          return;
        }
        setScanSucceeded(true);
        lastScanKeyRef.current = scanKey;
        discoveryInFlightRef.current = false;
        await loadWorkspace();
      } catch (err) {
        if (seq !== discoverySeqRef.current) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Discovery failed.';
        setDiscoveryError(message);
        onError(message);
      } finally {
        if (seq === discoverySeqRef.current) {
          discoveryInFlightRef.current = false;
          setDiscoverLoading(false);
        }
      }
    },
    [loadWorkspace, onError],
  );

  return (
    <section className="upload-hero">
      <ArtifactLoadPanelHero />
      <ArtifactLoadPanelForm
        readinessRegionId={readinessRegionId}
        readinessLabel={readinessLabel}
        discoveryError={discoveryError}
        onScan={() => {
          void runDiscovery(true);
        }}
        sourceKind={sourceKind}
        onSourceKindChange={(nextKind) => {
          setSourceKind(nextKind);
          setScanSucceeded(false);
          setDiscoveryError(null);
          lastScanKeyRef.current = '';
          onError(null);
        }}
        location={location}
        onLocationChange={setLocation}
        impersonatedServiceAccount={impersonatedServiceAccount}
        onImpersonatedServiceAccountChange={setImpersonatedServiceAccount}
        onImpersonatedServiceAccountBlur={() => {
          if (sourceKindRef.current !== 'gcs') {
            return;
          }
          if (locationRef.current.trim() === '') {
            return;
          }
          void runDiscovery(false);
        }}
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
        discoverLoading={discoverLoading}
        canLoad={canLoad}
        loadLoading={loadLoading}
        loadWorkspaceHint={loadWorkspaceHint}
        onLoadWorkspace={() => {
          void loadWorkspace();
        }}
      />
    </section>
  );
}
