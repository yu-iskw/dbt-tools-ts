import type { GraphNodeAttributes } from '../types';

/**
 * Legacy CLI `search` scoring: AND across terms; 0 means no match.
 * Kept stable for backward compatibility with existing `search` output ordering.
 */
export function legacySearchScore(attrs: GraphNodeAttributes, terms: string[]): number {
  if (terms.length === 0) return 1;

  let score = 0;
  const lName = (attrs.name || '').toLowerCase();
  const lId = (attrs.unique_id || '').toLowerCase();
  const lPkg = (attrs.package_name || '').toLowerCase();
  const lPath = ((attrs.path as string | undefined) || '').toLowerCase();
  const lTags = ((attrs.tags as string[] | undefined) || []).map((t) => t.toLowerCase());

  for (const rawTerm of terms) {
    const term = rawTerm.toLowerCase();
    if (lName === term || lId === term) {
      score += 10;
    } else if (lName.includes(term) || lId.includes(term)) {
      score += 5;
    } else if (lPkg.includes(term) || lPath.includes(term)) {
      score += 2;
    } else if (lTags.some((t) => t.includes(term))) {
      score += 3;
    } else {
      return 0;
    }
  }

  return score;
}
