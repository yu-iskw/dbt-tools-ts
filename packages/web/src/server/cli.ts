import {
  applyEntrypointRemoteOptionsToEnv,
  parseDbtToolsArtifactTarget,
  resolveEntrypointRemoteOptions,
} from '@dbt-tools/core';

import { parseCliArgs, readWebPackageVersion, USAGE } from './cli-args';
import { LISTEN_HOST, startServer } from './serve.js';

const parsed = parseCliArgs(process.argv.slice(2));
if (parsed.kind === 'help') {
  process.stdout.write(USAGE);
  process.exit(0);
}
if (parsed.kind === 'version') {
  process.stdout.write(`${readWebPackageVersion()}\n`);
  process.exit(0);
}
if (parsed.kind === 'error') {
  process.stderr.write(`${parsed.message}\n`);
  process.exit(1);
}

const { port, explicit, usedTargetAlias } = parsed;

try {
  const resolved = resolveEntrypointRemoteOptions(explicit);
  applyEntrypointRemoteOptionsToEnv(explicit);
  if (usedTargetAlias && resolved.dbtTarget != null) {
    const location = parseDbtToolsArtifactTarget(resolved.dbtTarget, process.cwd());
    if (location.kind === 'local') {
      process.env.DBT_TOOLS_TARGET_DIR = resolved.dbtTarget;
    }
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

await startServer(port);

const url = `http://${LISTEN_HOST}:${port}`;
process.stdout.write(`dbt-tools-web  ${url}\n`);
