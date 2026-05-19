import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** True when this module is the Node entry script (not merely imported). */
export function isCliEntrypoint(
  metaUrl: string,
  argv1: string | undefined = process.argv[1],
): boolean {
  if (argv1 == null) return false;
  return path.resolve(fileURLToPath(metaUrl)) === path.resolve(argv1);
}
