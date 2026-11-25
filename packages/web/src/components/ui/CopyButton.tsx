import { useToast } from './Toast';

import type { ReactElement } from 'react';

/** Returns a function that copies text to the clipboard and confirms with a toast. */
export function useCopyToClipboard(label: string): (value: string) => void {
  const { toast } = useToast();
  return (value) => {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    const written = clipboard?.writeText
      ? clipboard.writeText(value)
      : Promise.reject(new Error('Clipboard unavailable'));
    written.then(
      () => toast(`Copied ${label}`, 'positive'),
      () => toast(`Could not copy ${label}`, 'danger'),
    );
  };
}

/**
 * Small icon button that copies `value` to the clipboard and confirms with a toast.
 * Pass a function when the value can change between render and click (e.g. the page URL).
 */
export function CopyButton({
  value,
  label,
}: {
  value: string | (() => string);
  label: string;
}): ReactElement {
  const copyText = useCopyToClipboard(label);
  const copy = () => copyText(typeof value === 'function' ? value() : value);

  return (
    <button type="button" className="copy-button" aria-label={`Copy ${label}`} onClick={copy}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x="9"
          y="9"
          width="11"
          height="11"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
