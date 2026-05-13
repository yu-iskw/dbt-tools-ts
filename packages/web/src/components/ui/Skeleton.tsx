import type { CSSProperties } from 'react';

interface SkeletonProps {
  /** Additional class names. */
  className?: string;
  /** Inline style overrides — useful for setting width / height / border-radius. */
  style?: CSSProperties;
}

/**
 * A shimmer placeholder used while content is loading. Style it by passing
 * `style` props for width and height, or apply classes via `className`.
 */
export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={['skeleton', className].filter(Boolean).join(' ')}
      style={style}
      aria-hidden="true"
    />
  );
}
