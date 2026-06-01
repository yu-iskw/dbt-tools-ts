import type {
  ArtifactWorkspaceLoadOptions,
  ArtifactWorkspaceStatus,
} from '@dbt-tools/core/artifact-workspace';

export type { ArtifactWorkspaceLoadOptions };

export interface ArtifactWorkspaceControl {
  getStatus(): Promise<ArtifactWorkspaceStatus>;
  refreshIfChanged(options?: ArtifactWorkspaceLoadOptions): Promise<ArtifactWorkspaceStatus>;
  setTarget(
    target: string,
    options?: ArtifactWorkspaceLoadOptions,
  ): Promise<ArtifactWorkspaceStatus>;
  unsetTarget(): Promise<ArtifactWorkspaceStatus>;
  clearCachedTargets(): Promise<ArtifactWorkspaceStatus>;
}
