/** Reject cross-origin postMessage when the platform exposes an origin (CodeQL js/missing-origin-check). */
export function isTrustedDedicatedWorkerMessage(event: MessageEvent): boolean {
  const origin = event.origin;
  if (origin === '' || origin === 'null') {
    return true;
  }
  try {
    return origin === globalThis.location.origin;
  } catch {
    return false;
  }
}
