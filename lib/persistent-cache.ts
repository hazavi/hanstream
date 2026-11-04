import 'server-only';
import { createHash } from 'node:crypto';
import { createClient } from 'redis';
import { count } from './diagnostics';

type Store = { get(key: string): Promise<string | null>; set(key: string, value: string, options: { EX: number }): Promise<unknown> };
let connection: Promise<Store | undefined> | undefined;
let cooldown = 0;
const MAX_BYTES = 2_000_000;

async function store() {
  if (!process.env.CACHE_URL || Date.now() < cooldown) return undefined;
  if (!connection) connection = (async () => {
    const url = new URL(process.env.CACHE_URL!);
    if (url.protocol !== 'rediss:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'redis:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Cache requires TLS');
    const client = createClient({ url: url.href, disableOfflineQueue: true, socket: { connectTimeout: 700, reconnectStrategy: false } });
    client.on('error', () => { count('cache.failure'); cooldown = Date.now() + 60_000; connection = undefined; if (client.isOpen) client.destroy(); });
    await client.connect();
    return client;
  })().catch(() => { count('cache.failure'); cooldown = Date.now() + 60_000; connection = undefined; return undefined; });
  return connection;
}

async function bounded<T>(task: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Cache timeout')), 800); })]); }
  finally { clearTimeout(timer); }
}

/** Cache only assembled metadata, never stream responses or private configuration. */
export function persistentLoader<T>(namespace: string, load: (key: string, previous?: T) => Promise<T>, accept: (value: T) => boolean, freshMs = 300_000) {
  const refreshing = new Map<string, Promise<T>>();
  const prefix = createHash('sha256').update(Object.entries(process.env).filter(([key]) => /_SOURCE_URL$/.test(key)).sort().map(([key, value]) => `${key}=${value}`).join('\n')).digest('hex').slice(0, 16);
  return async (key: string, previous?: T): Promise<T> => {
    const id = `hanstream:v1:${prefix}:${namespace}:${createHash('sha256').update(key).digest('hex')}`;
    let saved = previous;
    let fetchedAt = 0;
    const cache = await store();
    if (!saved && cache) {
      try {
        const raw = await bounded(cache.get(id));
        if (raw && Buffer.byteLength(raw) <= MAX_BYTES) {
          const entry = JSON.parse(raw);
          if (entry.version === 1 && Number.isFinite(entry.fetchedAt) && Date.now() - entry.fetchedAt >= 0 && Date.now() - entry.fetchedAt < 86_400_000 && accept(entry.value)) {
            saved = entry.value; fetchedAt = entry.fetchedAt; count('cache.hit');
          }
        }
        if (!saved) count('cache.miss');
      } catch { count('cache.failure'); }
    }
    const refresh = () => {
      let pending = refreshing.get(key);
      if (!pending) {
        pending = load(key, saved).then(value => {
          if (cache && accept(value)) {
            const raw = JSON.stringify({ version: 1, fetchedAt: Date.now(), value });
            if (Buffer.byteLength(raw) <= MAX_BYTES) void bounded(cache.set(id, raw, { EX: 86_400 })).catch(() => count('cache.failure'));
          }
          return value;
        }).finally(() => refreshing.delete(key));
        refreshing.set(key, pending);
      }
      return pending;
    };
    if (saved && fetchedAt) {
      if (Date.now() - fetchedAt >= freshMs) void refresh().catch(() => {});
      return saved;
    }
    return refresh().catch(error => { if (saved) return saved; throw error; });
  };
}
