import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
  type ReactElement,
} from 'react';

import type { StatusTone } from '@web/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ToastItem {
  id: number;
  message: string;
  tone: StatusTone;
}

interface ToastContextValue {
  /** Show a toast notification. Defaults to "neutral" tone. */
  toast: (message: string, tone?: StatusTone) => void;
}

// ─── Context ────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

let nextId = 0;
const DISMISS_MS = 4000;

// ─── Provider ───────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }): ReactElement {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, tone: StatusTone = 'neutral') => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, DISMISS_MS);
  }, []);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-portal" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast--${t.tone}`}>
              <span className="toast__dot" aria-hidden="true" />
              <span className="toast__message">{t.message}</span>
              <button
                type="button"
                className="toast__dismiss"
                aria-label="Dismiss notification"
                onClick={() => dismiss(t.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/** Returns the `toast` function to imperatively show toast notifications. */
export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
