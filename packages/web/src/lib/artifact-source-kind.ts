/**
 * How analysis buffers were obtained (dev live target, remote object store, or user upload).
 * Shared by the analysis worker protocol and workspace UI; keep this module free of fetch/Node.
 */
export type WorkspaceArtifactSource = 'preload' | 'remote' | 'upload';
