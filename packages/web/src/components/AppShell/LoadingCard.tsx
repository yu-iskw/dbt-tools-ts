import { Skeleton } from '../ui/Skeleton';

import type { ReactElement } from 'react';

export function LoadingCard(): ReactElement {
  return (
    <div className="loading-card">
      <Skeleton className="loading-card__skeleton-icon" />
      <div>
        <Skeleton className="loading-card__skeleton-title" />
        <Skeleton className="loading-card__skeleton-body" />
      </div>
    </div>
  );
}
