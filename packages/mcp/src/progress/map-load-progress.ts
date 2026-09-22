import type { ArtifactLoadProgress } from '@dbt-tools/core/progress/artifact-load-progress';

const MIN_NOTIFY_INTERVAL_MS = 200;

export type McpProgressToken = number | string;

export interface McpProgressNotification {
  method: 'notifications/progress';
  params: {
    progressToken: McpProgressToken;
    progress: number;
    total?: number;
    message?: string;
  };
}

export interface McpToolProgressExtra {
  _meta?: { progressToken?: McpProgressToken };
  notify(notification: McpProgressNotification): Promise<void>;
}

export function createMcpLoadProgressNotifier(
  extra: McpToolProgressExtra | undefined,
): ((event: ArtifactLoadProgress) => void) | undefined {
  if (extra == null) return undefined;
  const progressToken = extra._meta?.progressToken;
  if (progressToken === undefined) return undefined;

  let lastEmitMs = 0;
  let lastProgress = -1;

  return (event: ArtifactLoadProgress) => {
    if (event.progress < lastProgress || event.phase === 'validate-target') {
      lastProgress = -1;
    }
    if (event.progress <= lastProgress) {
      return;
    }
    const now = Date.now();
    if (event.progress < 100 && now - lastEmitMs < MIN_NOTIFY_INTERVAL_MS) {
      return;
    }
    lastEmitMs = now;
    lastProgress = event.progress;
    void extra.notify({
      method: 'notifications/progress',
      params: {
        progressToken,
        progress: event.progress,
        total: 100,
        message: event.message,
      },
    });
  };
}
