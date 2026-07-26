import type { ArtifactLoadProgress } from '@dbt-tools/core/progress/artifact-load-progress';
import type { ServerContext } from '@modelcontextprotocol/server';

const MIN_NOTIFY_INTERVAL_MS = 200;

export type McpToolRequestExtra = ServerContext;

export function createMcpLoadProgressNotifier(
  ctx: McpToolRequestExtra | undefined,
): ((event: ArtifactLoadProgress) => void) | undefined {
  const progressToken = ctx?.mcpReq._meta?.progressToken;
  if (progressToken === undefined || ctx == null) return undefined;

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
    void ctx.mcpReq.notify({
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
