import type { ReactElement, ReactNode } from 'react';

interface EmptyStateProps {
  /** An emoji or small icon element shown above the headline. */
  icon?: ReactNode | string;
  /** The primary message — short, specific, and actionable. */
  headline: string;
  /** Optional supporting text with more context. */
  subtext?: string;
}

/**
 * A polished empty-state block for use inside workspace cards and panes.
 * Replace bare `<div className="empty-state">…</div>` text with this
 * component wherever the empty state is prominent.
 *
 * @example
 * <EmptyState
 *   icon="🔍"
 *   headline="No matching rows"
 *   subtext="Try adjusting the status filter or search query."
 * />
 */
export function EmptyState({ icon, headline, subtext }: EmptyStateProps): ReactElement {
  return (
    <div className="empty-state-block">
      {icon !== undefined && (
        <span className="empty-state-block__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <strong className="empty-state-block__headline">{headline}</strong>
      {subtext && <p className="empty-state-block__subtext">{subtext}</p>}
    </div>
  );
}
