import 'server-only';

type Metric = 'html.hit' | 'html.miss' | 'html.failure' | 'cache.hit' | 'cache.miss' | 'cache.failure' | 'image.hit' | 'image.miss' | 'image.failure';
const counters = new Map<Metric, number>();
export function count(metric: Metric) { counters.set(metric, (counters.get(metric) || 0) + 1); }
export function diagnosticSnapshot() {
  return { uptimeSeconds: Math.floor(process.uptime()), counters: Object.fromEntries(counters) };
}
