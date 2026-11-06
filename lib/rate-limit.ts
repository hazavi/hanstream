import 'server-only';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { cacheCommand } from './persistent-cache';

const windows = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 60_000;
const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],120) end; return n";
export function clearRateLimits() { windows.clear(); }

export function clientBucket(headers: Headers) {
  // Vercel overwrites this platform header. Never infer trust from an incoming header alone.
  const vercel=process.env.VERCEL==='1';
  const header = vercel ? 'x-vercel-forwarded-for' : process.env.RATE_LIMIT_IP_HEADER?.toLowerCase();
  // Enable only when the deployment's trusted proxy overwrites this exact header.
  const value = (vercel || process.env.TRUST_PROXY === '1') && header && /^[a-z-]+$/.test(header) ? headers.get(header)?.trim() : undefined;
  return value && isIP(value) ? createHash('sha256').update(value).digest('hex') : 'shared';
}

export async function checkRateLimit(path: string, headers: Headers) {
  if (path === '/api/health' || path === '/api/diagnostics') return { allowed: true, retryAfter: 0 };
  const bucket = clientBucket(headers);
  const category = path === '/api/search' ? 'search' : path.startsWith('/api/drama/') ? 'detail' : path === '/api/artwork' || path === '/api/portrait' ? 'image' : 'catalog';
  const limit = bucket === 'shared' ? { search: 120, detail: 180, image: 600, catalog: 300 }[category] : { search: 30, detail: 60, image: 180, catalog: 120 }[category];
  const now = Date.now();
  const window = Math.floor(now / WINDOW_MS);
  const key = `${category}:${bucket}:${window}`;
  let saved = windows.get(key);
  if (!saved) {
    saved = { count: 0, until: (window + 1) * WINDOW_MS }; windows.set(key, saved);
    for (const [key, value] of windows) if (value.until <= now) windows.delete(key);
    while (windows.size > 10_000) windows.delete(windows.keys().next().value!);
  }
  saved.count++;
  if (saved.count > limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((saved.until - now) / 1000)) };
  const shared = await cacheCommand(client => client.eval(script, { keys: [`hanstream:rate:v1:${key}`], arguments: [] }));
  return { allowed: shared === undefined || Number(shared) <= limit, retryAfter: Math.max(1, Math.ceil((saved.until - now) / 1000)) };
}
