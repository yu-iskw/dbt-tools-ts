import appLogoUrl from '@web/assets/app-logo.svg';

import type { ReactElement } from 'react';

export function AppLogo({
  className,
  size,
  title,
  testId,
}: {
  className?: string;
  size?: number;
  title?: string;
  testId?: string;
}): ReactElement {
  return (
    <img
      src={appLogoUrl}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      className={className}
      style={size ? { width: `${size}px`, height: `${size}px` } : undefined}
      data-testid={testId}
    />
  );
}
