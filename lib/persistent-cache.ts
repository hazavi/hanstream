import 'server-only';
import { createHash } from 'node:crypto';
import { createClient } from 'redis';
import { count } from './diagnostics';

type Store = { get(key: string): Promise<string | null>; set(key: string, value: string, options: { EX: number }): Promise<unknown>; eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>; isOpen: boolean; destroy(): void };
let connection: Promise<Store | undefined> | undefined;
let cooldown = 0;
const MAX_BYTES = 2_000_000;

export function cacheConnectionUrl(env=process.env) {
  const url = new URL(env.CACHE_URL || '');
  const privateRender = env.RENDER === 'true' && url.hostname === env.CACHE_PRIVATE_HOST && /^red-[a-z0-9]+$/.test(url.hostname) && url.port === '6379';
  const local = env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'rediss:' && !(url.protocol === 'redis:' && (local || privateRender))) throw new Error('Cache requires TLS or the explicitly configured Render private host');
  return url.href;
}

async function store() {
  if (!process.env.CACHE_URL || Date.now() < cooldown) return undefined;
  if (!connection) connection = (async () => {
    const url = new URL(cacheConnectionUrl());
    const client = createClient({ url: url.href, disableOfflineQueue: true, commandsQueueMaxLength: 100, socket: { connectTimeout: 700, reconnectStrategy: false } });
    client.on('error', () => { count('cache.failure'); cooldown = Date.now() + 60_000; connection = undefined; if (client.isOpen) client.destroy(); });
    await client.connect();
    return client;
  })().catch(() => { count('cache.failure'); cooldown = Date.now() + 60_000; connection = undefined; return undefined; });
  return connection;
}

async function bounded<T>(task: Promise<T>, client: Store): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Cache timeout')), 800); })]); }
  catch (error) { cooldown = Date.now() + 60_000; connection = undefined; if (client.isOpen) client.destroy(); throw error; }
  finally { clearTimeout(timer); }
}

export async function cacheCommand<T>(run: (client: Store) => Promise<T>): Promise<T | undefined> {
  const client = await store();
  if (!client) return undefined;
  try { return await bounded(run(client), client); } catch { count('cache.failure'); return undefined; }
}

/** Cache only assembled metadata, never stream responses or private configuration. */
export function persistentLoader<T>(namespace: string, load: (key: string, previous?: T) => Promise<T>, accept: (value: T) => boolean, freshMs = 300_000) {
  const refreshing = new Map<string, Promise<T>>();
  const prefix = createHash('sha256').update(Object.entries(process.env).filter(([key]) => /_SOURCE_URL$/.test(key)).sort().map(([key, value]) => `${key}=${value}`).join('\n')).digest('hex').slice(0, 16);
  const cacheKey = (key:string) => `hanstream:v1:${prefix}:${namespace}:${createHash('sha256').update(key).digest('hex')}`;
  const remember = async (key:string,value:T) => {
    if (!accept(value)) return false;
    const raw=JSON.stringify({version:1,fetchedAt:Date.now(),value});
    if (Buffer.byteLength(raw)>MAX_BYTES) return false;
    const cache=await store();
    if (!cache) return false;
    try { await bounded(cache.set(cacheKey(key),raw,{EX:86_400}),cache);return true; }
    catch { count('cache.failure');return false; }
  };
  const read = async (key: string, previous?: T): Promise<T> => {
    const id = cacheKey(key);
    let saved = previous;
    let fetchedAt = 0;
    const cache = await store();
    if (!saved && cache) {
      try {
        const raw = await bounded(cache.get(id), cache);
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
          if (cache) void remember(key,value);
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
  return Object.assign(read,{remember});
}
