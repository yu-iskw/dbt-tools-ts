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

function buildArtifactScanKey(
  kind: UserArtifactSourceKind,
  locationTrimmed: string,
  impersonationTrimmed: string,
): string {
  return kind === 'gcs'
    ? `gcs|${locationTrimmed}|${impersonationTrimmed}`
    : `${kind}|${locationTrimmed}`;
}

function discoveryMismatchMessage(
  kind: UserArtifactSourceKind,
  locationTrimmed: string,
  impersonationTrimmed: string,
  lastScannedKey: string,
): string | null {
  if (locationTrimmed === '') {
    return null;
  }
  const inputKey = buildArtifactScanKey(kind, locationTrimmed, impersonationTrimmed);
  if (lastScannedKey !== '' && inputKey === lastScannedKey) {
    return null;
  }
  return 'Run artifact discovery again after changing the location or connection settings.';
}

function loadPrecheckMessage(
  kind: UserArtifactSourceKind,
  locationTrimmed: string,
  impersonationTrimmed: string,
  lastScannedKey: string,
  discoveryInFlight: boolean,
): string | null {
  if (discoveryInFlight) {
    return 'Wait for artifact discovery to finish, then try loading again.';
  }
  return discoveryMismatchMessage(kind, locationTrimmed, impersonationTrimmed, lastScannedKey);
}

function gcsClientOptionsFromRefs(
  kind: UserArtifactSourceKind,
  impersonatedServiceAccountRaw: string,
): GcsArtifactSourceClientOptions | undefined {
  if (kind !== 'gcs') return undefined;
  return { impersonatedServiceAccount: impersonatedServiceAccountRaw };
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
  const [lastScannedKey, setLastScannedKey] = useState('');
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const locationRef = useRef(location);
  const sourceKindRef = useRef(sourceKind);
  const impersonatedServiceAccountRef = useRef(impersonatedServiceAccount);
  const lastScannedKeyRef = useRef(lastScannedKey);
  locationRef.current = location;
  sourceKindRef.current = sourceKind;
  impersonatedServiceAccountRef.current = impersonatedServiceAccount;
  lastScannedKeyRef.current = lastScannedKey;

  const discoverySeqRef = useRef(0);
  const discoveryInFlightRef = useRef(false);

  const locationTrimmed = location.trim();
  const impersonationTrimmed = impersonatedServiceAccount.trim();
  const inputKey = buildArtifactScanKey(sourceKind, locationTrimmed, impersonationTrimmed);
  const scanFresh = lastScannedKey !== '' && inputKey === lastScannedKey;

  const readinessInput = useMemo(
    () => ({
      discoverLoading,
      discoveryError,
      scanSucceeded: scanFresh,
      location,
    }),
    [discoverLoading, discoveryError, location, scanFresh],
  );

  const readinessLabel = useMemo(() => getArtifactReadinessLabel(readinessInput), [readinessInput]);

  const canLoad = scanFresh && !loadLoading && !discoverLoading && discoveryError == null;

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
    const impersonation = impersonatedServiceAccountRef.current.trim();
    const precheck = loadPrecheckMessage(
      kind,
      loc,
      impersonation,
      lastScannedKeyRef.current,
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
        lastScannedKeyRef.current = '';
        setLastScannedKey('');
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
      const scanKey = buildArtifactScanKey(kind, loc, impersonationTrimmed);
      if (loc === '') {
        onError('Enter a directory or bucket prefix.');
        return;
      }
      if (!force && scanKey === lastScannedKeyRef.current) {
        return;
      }
      const seq = ++discoverySeqRef.current;
      discoveryInFlightRef.current = true;
      setDiscoverLoading(true);
      onError(null);
      setDiscoveryError(null);
      lastScannedKeyRef.current = '';
      setLastScannedKey('');
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
        lastScannedKeyRef.current = scanKey;
        setLastScannedKey(scanKey);
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
          setDiscoveryError(null);
          lastScannedKeyRef.current = '';
          setLastScannedKey('');
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
