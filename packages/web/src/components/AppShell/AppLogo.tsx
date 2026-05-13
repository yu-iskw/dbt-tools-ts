import appLogoUrl from '@web/assets/app-logo.svg';

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
}) {
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
