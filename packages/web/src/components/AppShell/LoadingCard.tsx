import { Skeleton } from '../ui/Skeleton';

export function LoadingCard() {
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
