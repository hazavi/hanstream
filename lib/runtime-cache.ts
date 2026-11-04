import "server-only";

/** Process-local data only. No catalog is read from or written to the repository. */
export function createRuntimeCache<T>(load: (previous?: T) => Promise<T>, ttl: number | ((value: T) => number), serveStale: (value: T) => boolean = () => true) {
  let value: T | undefined;
  let expires = 0;
  let pending: Promise<T> | undefined;
  const refresh = () => {
    if (!pending) {
      pending = load(value).then(next => {
        value = next;
        expires = Date.now() + (typeof ttl === 'number' ? ttl : ttl(next));
        return next;
      }).catch(error => {
        // Preserve live data already fetched by this process during a temporary outage.
        expires = Date.now() + Math.min(typeof ttl === 'number' ? ttl : 15_000, 60_000);
        throw error;
      }).finally(() => { pending = undefined; });
    }
    return pending;
  };
  const read = async () => {
    if (value === undefined) return refresh();
    if (Date.now() >= expires) {
      if (!serveStale(value)) return refresh().catch(() => value!);
      void refresh().catch(() => {});
    }
    return value;
  };
  return Object.assign(read, { peek: () => value, prime: (next: T) => { value = next; expires = Date.now() + (typeof ttl === 'number' ? ttl : ttl(next)); } });
}

/** Reuse complete per-title results immediately while expired records refresh once. */
export function createKeyedStaleCache<T>(load: (key: string, previous?: T) => Promise<T>, ttl: number | ((value: T) => number), capacity = 100, serveStale: (value: T) => boolean = () => true) {
  const entries = new Map<string, ReturnType<typeof createRuntimeCache<T>>>();
  const readKey = (key: string) => {
    let read = entries.get(key);
    if (!read) read = createRuntimeCache(previous => load(key, previous), ttl, serveStale);
    entries.delete(key);
    entries.set(key, read);
    if (entries.size > capacity) entries.delete(entries.keys().next().value!);
    return read();
  };
  return Object.assign(readKey, {clear:()=>entries.clear()});
}

/** Coalesce title-specific requests and keep the process cache bounded. */
export function createKeyedCache<T>(load: (key: string) => Promise<T>, ttl = 900_000, capacity = 100, missTtl = 30_000) {
  const entries = new Map<string, { expires: number; pending: Promise<T> }>();
  return (key: string): Promise<T> => {
    const existing = entries.get(key);
    if (existing && existing.expires > Date.now()) return existing.pending;
    const entry = { expires: Number.POSITIVE_INFINITY, pending: Promise.resolve().then(() => load(key)) };
    entries.set(key, entry);
    entry.pending.then(value => { entry.expires = Date.now() + (value == null ? missTtl : ttl); }, () => { if (entries.get(key) === entry) entries.delete(key); });
    if (entries.size > capacity) entries.delete(entries.keys().next().value!);
    return entry.pending;
  };
}
