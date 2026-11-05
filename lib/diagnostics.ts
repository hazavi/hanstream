import 'server-only';

type Metric = 'html.hit' | 'html.miss' | 'html.failure' | 'cache.hit' | 'cache.miss' | 'cache.failure' | 'image.hit' | 'image.miss' | 'image.failure';
const counters = new Map<Metric, number>();
const readers = new Map<string, { outcome: 'ok' | 'unavailable'; records: number; at: string }>();
/** Fixed reader roles only. Never store URLs, query text, headers, or response bodies. */
export function observeReader(role: 'calendar-discovery' | 'calendar-index' | 'calendar-filter', records: number | null) {
  readers.set(role, { outcome: records === null ? 'unavailable' : 'ok', records: records || 0, at: new Date().toISOString() });
}
export function count(metric: Metric) { counters.set(metric, (counters.get(metric) || 0) + 1); }
export function diagnosticSnapshot() {
  return { uptimeSeconds: Math.floor(process.uptime()), counters: Object.fromEntries(counters), readers: Object.fromEntries(readers) };
}
