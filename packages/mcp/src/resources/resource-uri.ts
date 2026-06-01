export type DbtToolsResourceRequest =
  | { kind: 'status' }
  | { kind: 'run-summary'; runId: 'current' }
  | { kind: 'resource-details'; uniqueId: string }
  | { kind: 'resource-sql'; uniqueId: string; sqlKind: 'raw' | 'compiled' }
  | {
      kind: 'resource-dependencies';
      uniqueId: string;
      direction: 'upstream' | 'downstream';
    };

export class DbtToolsResourceUriError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DbtToolsResourceUriError';
  }
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw new DbtToolsResourceUriError(`Malformed URI encoding in segment: ${segment}`);
  }
}

function rejectQuery(url: URL): void {
  if (url.search !== '' || url.hash !== '') {
    throw new DbtToolsResourceUriError(
      'Query parameters are not supported on dbt-tools resource URIs.',
    );
  }
}

/**
 * Parse a `dbt-tools://` resource URI into a structured request.
 */
export function parseDbtToolsResourceUri(uriString: string): DbtToolsResourceRequest {
  let url: URL;
  try {
    url = new URL(uriString);
  } catch {
    throw new DbtToolsResourceUriError(`Invalid resource URI: ${uriString}`);
  }

  if (url.protocol !== 'dbt-tools:') {
    throw new DbtToolsResourceUriError('Resource URI scheme must be dbt-tools:');
  }

  rejectQuery(url);

  const host = url.hostname;
  const segments = url.pathname.split('/').filter((segment) => segment.length > 0);

  if (host === 'status') {
    if (segments.length > 0) {
      throw new DbtToolsResourceUriError(
        'dbt-tools://status must not include extra path segments.',
      );
    }
    return { kind: 'status' };
  }

  if (host === 'runs') {
    if (segments.length === 2 && segments[0] === 'current' && segments[1] === 'summary') {
      return { kind: 'run-summary', runId: 'current' };
    }
    throw new DbtToolsResourceUriError(
      'Unsupported runs resource path. Use dbt-tools://runs/current/summary.',
    );
  }

  if (host === 'resources') {
    if (segments.length === 0) {
      throw new DbtToolsResourceUriError('Resource unique_id is required in the URI path.');
    }

    const uniqueId = decodePathSegment(segments[0]!);

    if (segments.length === 1) {
      return { kind: 'resource-details', uniqueId };
    }

    if (segments.length === 3 && segments[1] === 'sql') {
      const sqlKind = segments[2];
      if (sqlKind === 'raw' || sqlKind === 'compiled') {
        return { kind: 'resource-sql', uniqueId, sqlKind };
      }
      throw new DbtToolsResourceUriError('SQL kind must be raw or compiled.');
    }

    if (segments.length === 3 && segments[1] === 'dependencies') {
      const direction = segments[2];
      if (direction === 'upstream' || direction === 'downstream') {
        return { kind: 'resource-dependencies', uniqueId, direction };
      }
      throw new DbtToolsResourceUriError('Dependency direction must be upstream or downstream.');
    }

    throw new DbtToolsResourceUriError('Unsupported resources URI path shape.');
  }

  throw new DbtToolsResourceUriError(`Unknown dbt-tools resource host: ${host}`);
}
