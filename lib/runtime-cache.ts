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
  const read = async () => {
    if (value === undefined) return refresh();
    if (Date.now() >= expires) void refresh().catch(() => {});
    return value;
  };
  return Object.assign(read, { peek: () => value, prime: (next: T) => { value = next; expires = Date.now() + ttl; } });
}

/** Coalesce title-specific requests and keep the process cache bounded. */
export function createKeyedCache<T>(load: (key: string) => Promise<T>, ttl = 900_000, capacity = 100) {
  const entries = new Map<string, { expires: number; pending: Promise<T> }>();
  return (key: string): Promise<T> => {
    const existing = entries.get(key);
    if (existing && existing.expires > Date.now()) return existing.pending;
    const entry = { expires: Number.POSITIVE_INFINITY, pending: Promise.resolve().then(() => load(key)) };
    entries.set(key, entry);
    entry.pending.then(value => { entry.expires = Date.now() + (value == null ? 30_000 : ttl); }, () => { if (entries.get(key) === entry) entries.delete(key); });
    if (entries.size > capacity) entries.delete(entries.keys().next().value!);
    return entry.pending;
  };
}
