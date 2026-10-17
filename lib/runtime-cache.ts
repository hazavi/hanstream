import "server-only";

/** Process-local data only. No catalog is read from or written to the repository. */
export function createRuntimeCache<T>(load: (previous?: T) => Promise<T>, ttl: number) {
  let value: T | undefined;
  let expires = 0;
  let pending: Promise<T> | undefined;
  const refresh = () => {
    if (!pending) {
      pending = load(value).then(next => {
        value = next;
        expires = Date.now() + ttl;
        return next;
      }).catch(error => {
        // Preserve live data already fetched by this process during a temporary outage.
        expires = Date.now() + Math.min(ttl, 60_000);
        throw error;
      }).finally(() => { pending = undefined; });
    }
    return pending;
  };
  return async () => {
    if (value === undefined) return refresh();
    if (Date.now() >= expires) void refresh().catch(() => {});
    return value;
  };
}
