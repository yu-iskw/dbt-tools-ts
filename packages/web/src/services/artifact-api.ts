/**
 * Public facade: artifact-source HTTP client and types. Implementation:
 * `artifactSourceApi.ts` (fetch + run switching); server-side resolution:
 * `artifact-source/sourceService.ts`.
 */
export {
  configureArtifactSourceFromApi,
  discoverArtifactSourceFromApi,
  fetchArtifactSourceStatus,
  loadCurrentManagedArtifacts,
  acceptPendingRemoteRunFromApi,
  refetchFromApi,
  refreshArtifactSourceStatus,
  type ArtifactSourceDiscoveryResult,
  type ArtifactSourceStatus,
  type MissingOptionalArtifactsState,
  type RemoteArtifactRun,
  type UserArtifactSourceKind,
  type WorkspaceArtifactSource,
} from './artifact-source-api';
