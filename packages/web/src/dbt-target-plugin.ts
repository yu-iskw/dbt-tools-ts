import fs from 'node:fs';
import type { Plugin } from 'vite';
import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
  getDbtToolsReloadDebounceMs,
  isDbtToolsDebugEnabled,
  isDbtToolsWatchEnabled,
} from '@dbt-tools/core';
import { ArtifactSourceService } from './artifact-source/sourceService';
import { resolveWatchableLocalTargetDir } from './artifact-source/resolveLocalTargetDir';
import { tryHandleArtifactSourceViteRequest } from './artifact-source/viteArtifactRoutes';

function debugLog(...args: unknown[]) {
  if (isDbtToolsDebugEnabled()) {
    console.log('[dbt-target]', ...args);
  }
}

function setupArtifactWatch(
  resolved: string,
  server: { ws?: { send: (type: string, data?: object) => void } },
) {
  const debounceMs = Math.max(0, getDbtToolsReloadDebounceMs());
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const notify = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      server.ws?.send('dbt-artifacts-changed', {});
      debugLog('Artifacts changed, notified clients');
    }, debounceMs);
  };

  fs.watch(resolved, (_eventType, filename) => {
    if (
      filename === DBT_MANIFEST_JSON ||
      filename === DBT_RUN_RESULTS_JSON ||
      filename === DBT_CATALOG_JSON ||
      filename === DBT_SOURCES_JSON
    ) {
      notify();
    }
  });

  debugLog('Watching for artifact changes:', resolved);
}

/**
 * Vite plugin that serves the current artifact source and keeps the local
 * preload HMR reload loop for DBT_TOOLS_TARGET_DIR.
 */
export function dbtTargetPlugin(): Plugin {
  return {
    name: 'dbt-target',
    enforce: 'pre',
    configureServer(server) {
      const service = new ArtifactSourceService();

      server.middlewares.use((req, res, next) => {
        void (async () => {
          const handled = await tryHandleArtifactSourceViteRequest(req, res, service);
          if (!handled) next();
        })();
      });

      if (isDbtToolsWatchEnabled() && server.ws) {
        const resolved = resolveWatchableLocalTargetDir(process.cwd());
        if (resolved != null) {
          try {
            setupArtifactWatch(resolved, server);
          } catch (watchErr) {
            debugLog('Watch failed:', watchErr);
          }
        }
      }
    },
  };
}
