import { parseCliArgs, USAGE } from './cli-args';
import { LISTEN_HOST, startServer } from './serve.js';

const parsed = parseCliArgs(process.argv.slice(2));
if (parsed.kind === 'help') {
  process.stdout.write(USAGE);
  process.exit(0);
}
if (parsed.kind === 'error') {
  process.stderr.write(`${parsed.message}\n`);
  process.exit(1);
}

const { targetDir, port } = parsed;

if (targetDir !== undefined) {
  process.env.DBT_TOOLS_TARGET_DIR = targetDir;
}

await startServer(port);

const url = `http://${LISTEN_HOST}:${port}`;
process.stdout.write(`dbt-tools-web  ${url}\n`);
