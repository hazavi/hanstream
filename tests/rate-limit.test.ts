// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../lib/persistent-cache', () => ({ cacheCommand: vi.fn(async () => undefined) }));
import { cacheCommand } from '../lib/persistent-cache';
import { checkRateLimit, clearRateLimits, clientBucket } from '../lib/rate-limit';
afterEach(() => { clearRateLimits(); vi.unstubAllEnvs(); vi.useRealTimers(); vi.mocked(cacheCommand).mockReset(); });
it('ignores client-supplied IP headers until an overwriting trusted proxy is explicitly configured', () => {
  const headers = new Headers({ 'x-real-ip': '203.0.113.10' });
  expect(clientBucket(headers)).toBe('shared');
  vi.stubEnv('TRUST_PROXY', '1'); vi.stubEnv('RATE_LIMIT_IP_HEADER', 'x-real-ip');
  expect(clientBucket(headers)).not.toBe('shared');
  headers.set('x-real-ip', '203.0.113.10, 10.0.0.1'); expect(clientBucket(headers)).toBe('shared');
});
it('limits searches separately, permits normal page image loads, and recovers after expiry', async () => {
  vi.useFakeTimers(); const headers = new Headers();
  for (let index = 0; index < 120; index++) expect((await checkRateLimit('/api/search', headers)).allowed).toBe(true);
  expect((await checkRateLimit('/api/search', headers)).allowed).toBe(false);
  expect((await checkRateLimit('/api/artwork', headers)).allowed).toBe(true);
  expect((await checkRateLimit('/api/health', headers)).allowed).toBe(true);
  await vi.advanceTimersByTimeAsync(60_001);
  expect((await checkRateLimit('/api/search', headers)).allowed).toBe(true);
});
it('honors the shared-store counter across instances', async () => {
  vi.mocked(cacheCommand).mockResolvedValue(121);
  expect((await checkRateLimit('/api/search', new Headers())).allowed).toBe(false);
});
