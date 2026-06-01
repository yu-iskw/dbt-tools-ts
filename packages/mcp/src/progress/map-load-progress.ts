import type { ArtifactLoadProgress } from '@dbt-tools/core/progress/artifact-load-progress';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

const MIN_NOTIFY_INTERVAL_MS = 200;

export type McpToolRequestExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

export function createMcpLoadProgressNotifier(
  extra: McpToolRequestExtra | undefined,
): ((event: ArtifactLoadProgress) => void) | undefined {
  const progressToken = extra?._meta?.progressToken;
  if (progressToken === undefined || extra == null) return undefined;

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
    void extra.sendNotification({
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
