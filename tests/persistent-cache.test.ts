// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const client = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), connect: vi.fn(), on: vi.fn(), isOpen: false, destroy: vi.fn() }));
vi.mock('redis', () => ({ createClient: () => client }));
beforeEach(() => { vi.resetModules(); vi.stubEnv('CACHE_URL', 'rediss://cache.example:6380'); client.get.mockReset(); client.set.mockReset(); client.connect.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); client.isOpen = false; });
it('restores fresh metadata without reading sources after a process restart', async () => {
  client.get.mockResolvedValue(JSON.stringify({ version: 1, fetchedAt: Date.now(), value: { title: 'Saved' } }));
  const { persistentLoader } = await import('../lib/persistent-cache');
  const load = vi.fn();
  expect(await persistentLoader('detail', load, value => Boolean(value?.title))('show')).toEqual({ title: 'Saved' });
  expect(load).not.toHaveBeenCalled();
});
it('serves stale success immediately, coalesces refreshes, and never replaces it with a failed read', async () => {
  client.get.mockResolvedValue(JSON.stringify({ version: 1, fetchedAt: Date.now() - 400_000, value: { title: 'Saved' } }));
  let reject!: (error: Error) => void;
  const load = vi.fn(() => new Promise<{title:string}>((_, fail) => { reject = fail; }));
  const { persistentLoader } = await import('../lib/persistent-cache');
  const read = persistentLoader('detail', load, value => Boolean(value?.title));
  expect(await read('show')).toEqual({ title: 'Saved' });
  expect(await read('show')).toEqual({ title: 'Saved' });
  expect(load).toHaveBeenCalledOnce();
  reject(new Error('Unavailable')); await new Promise(resolve => setImmediate(resolve));
  expect(client.set).not.toHaveBeenCalled();
});
it('falls back to live loading when the store is corrupt or not configured', async () => {
  client.get.mockResolvedValue('{broken');
  const { persistentLoader } = await import('../lib/persistent-cache');
  const load = vi.fn(async () => ({ title: 'Live' }));
  expect(await persistentLoader('detail', load, value => Boolean(value?.title))('show')).toEqual({ title: 'Live' });
  expect(client.set).toHaveBeenCalledWith(expect.stringMatching(/^hanstream:v1:/), expect.not.stringContaining('rediss://'), { EX: 86_400 });
  vi.stubEnv('CACHE_URL', '');
  expect(await persistentLoader('detail', load, () => true)('other')).toEqual({ title: 'Live' });
});
it('destroys a stalled connection and falls back instead of leaving commands queued indefinitely', async () => {
  vi.useFakeTimers(); client.isOpen = true; client.destroy.mockClear();
  client.get.mockImplementation(() => new Promise(() => {}));
  const { persistentLoader } = await import('../lib/persistent-cache');
  const read = persistentLoader('detail', async () => ({title:'Live'}), () => true);
  const result = read('show');
  await vi.advanceTimersByTimeAsync(801);
  expect(await result).toEqual({title:'Live'}); expect(client.destroy).toHaveBeenCalledOnce();
});
