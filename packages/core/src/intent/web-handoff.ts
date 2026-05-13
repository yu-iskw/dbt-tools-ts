/**
 * Deterministic web deep links for CLI ↔ web parity (query-string workspace).
 */

function mergeUrlWithSearchParams(baseUrl: string, params: URLSearchParams): string {
  let s = baseUrl.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    s = `http://${s}`;
  }
  const u = new URL(s);
  for (const [k, v] of params) {
    u.searchParams.set(k, v);
  }
  if (u.pathname === '' || u.pathname === '/') {
    u.pathname = '/';
  }
  return u.toString();
}

export function buildDiscoverWebUrl(baseUrl: string, query: string): string {
  const params = new URLSearchParams();
  params.set('view', 'inventory');
  if (query.trim() !== '') {
    params.set('q', query.trim());
  }
  return mergeUrlWithSearchParams(baseUrl, params);
}

export function buildExplainWebUrl(baseUrl: string, uniqueId: string): string {
  const params = new URLSearchParams();
  params.set('view', 'inventory');
  params.set('resource', uniqueId);
  params.set('assetTab', 'summary');
  return mergeUrlWithSearchParams(baseUrl, params);
}

export function buildImpactWebUrl(baseUrl: string, uniqueId: string): string {
  const params = new URLSearchParams();
  params.set('view', 'inventory');
  params.set('resource', uniqueId);
  params.set('assetTab', 'lineage');
  return mergeUrlWithSearchParams(baseUrl, params);
}
