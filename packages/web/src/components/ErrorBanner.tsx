import type { ReactElement } from 'react';
interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps): ReactElement {
  return <div className="error-banner">{message}</div>;
}
