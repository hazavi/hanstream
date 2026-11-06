export class BackendRequestError extends Error {
  constructor(
    message: string,
    public retryable = true,
  ) {
    super(message);
  }
}

export function pauseRequest(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

/** Retry only while a visitor can use the result. Hidden/offline pages wait. */
export function waitForActivePage(signal: AbortSignal): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const active = () =>
    document.visibilityState !== "hidden" && navigator.onLine !== false;
  if (signal.aborted) return Promise.reject(signal.reason);
  if (active()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const clean = () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
      signal.removeEventListener("abort", abort);
    };
    const check = () => {
      if (active()) {
        clean();
        resolve();
      }
    };
    const abort = () => {
      clean();
      reject(signal.reason);
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export async function retryWhileActive<T>(
  load: (attempt: number) => Promise<T>,
  signal: AbortSignal,
  onRetry?: (error: unknown) => void,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await waitForActivePage(signal);
    if (signal.aborted) throw signal.reason;
    try {
      return await load(attempt);
    } catch (error) {
      if (
        signal.aborted ||
        (error instanceof BackendRequestError && !error.retryable)
      )
        throw error;
      onRetry?.(error);
      await pauseRequest(
        Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)),
        signal,
      );
    }
  }
}
