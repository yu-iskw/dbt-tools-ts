import type { GraphNodeAttributes } from '../types';

/**
 * Parse structured filters from free-text tokens, e.g. "type:model tag:finance".
 * Returns remaining plain terms after extracting key:value pairs.
 */
export function parseDiscoveryQueryTokens(query: string): {
  terms: string[];
  type?: string;
  package?: string;
  tag?: string;
  path?: string;
} {
  const tokens = query.split(/\s+/).filter(Boolean);
  const terms: string[] = [];
  let type: string | undefined;
  let pkg: string | undefined;
  let tag: string | undefined;
  let path: string | undefined;

  for (const token of tokens) {
    if (token.startsWith('type:')) {
      type = token.slice(5);
    } else if (token.startsWith('package:')) {
      pkg = token.slice(8);
    } else if (token.startsWith('tag:')) {
      tag = token.slice(4);
    } else if (token.startsWith('path:')) {
      path = token.slice(5);
    } else if (token.startsWith('owner:') || token.startsWith('source:')) {
      terms.push(token.slice(token.indexOf(':') + 1));
    } else {
      terms.push(token);
    }
  }

  return { terms, type, package: pkg, tag, path };
}

/** Apply structured filters (shared with CLI search). */
export function applyDiscoveryNodeFilters(
  attrs: GraphNodeAttributes,
  effectiveType: string | undefined,
  effectivePackage: string | undefined,
  effectiveTag: string | undefined,
  pathFilter: string | undefined,
): boolean {
  if (attrs.resource_type === 'field') return false;

  if (effectiveType) {
    const types = effectiveType
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (!types.includes(attrs.resource_type.toLowerCase())) return false;
  }

  if (effectivePackage) {
    if ((attrs.package_name || '') !== effectivePackage) return false;
  }

  if (effectiveTag) {
    const required = effectiveTag
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const nodeTags = ((attrs.tags as string[] | undefined) || []).map((t) => t.toLowerCase());
    if (!required.some((t) => nodeTags.includes(t))) return false;
  }

  if (pathFilter) {
    const nodePath = (attrs.path as string | undefined) || '';
    if (!nodePath.includes(pathFilter)) return false;
  }

  return true;
}
