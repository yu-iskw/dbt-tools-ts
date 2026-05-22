import { rmSyncValidated } from './safe-fs';

const trackedTempDirs = new Set<string>();
let exitHookRegistered = false;

/**
 * Register a remote-bundle temp directory for best-effort cleanup on process exit.
 */
export function trackArtifactBundleTempDir(dir: string): void {
  trackedTempDirs.add(dir);
  if (!exitHookRegistered) {
    exitHookRegistered = true;
    process.once('exit', () => {
      for (const tempDir of trackedTempDirs) {
        try {
          rmSyncValidated(tempDir, { recursive: true, force: true });
        } catch {
          // Best-effort cleanup on CLI/MCP shutdown.
        }
      }
    });
  }
}
