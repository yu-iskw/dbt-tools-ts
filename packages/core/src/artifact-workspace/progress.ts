import type {
  ArtifactLoadPhase,
  ArtifactLoadProgress,
  ArtifactLoadProgressCallback,
} from '../progress/artifact-load-progress.js';

/** Fan-out for MCP load progress and refresh listeners on a single channel. */
export class ArtifactLoadProgressHub {
  private callback: ArtifactLoadProgressCallback | undefined;
  private readonly listeners = new Set<ArtifactLoadProgressCallback>();

  getCallback(): ArtifactLoadProgressCallback | undefined {
    return this.callback;
  }

  setCallback(callback: ArtifactLoadProgressCallback | undefined): void {
    this.callback = callback;
  }

  swapCallback(
    callback: ArtifactLoadProgressCallback | undefined,
  ): ArtifactLoadProgressCallback | undefined {
    const previous = this.callback;
    this.callback = callback;
    return previous;
  }

  subscribe(listener: ArtifactLoadProgressCallback): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(phase: ArtifactLoadPhase, progress: number, message: string): void {
    const event: ArtifactLoadProgress = { phase, progress, message };
    this.callback?.(event);
    for (const listener of [...this.listeners]) {
      listener(event);
    }
  }
}
