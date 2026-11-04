// @vitest-environment node
import { expect, it, vi } from 'vitest';
const sources = vi.hoisted(() => ({
  home: vi.fn(async () => ({ starting: [], ending: [] })),
  recent: vi.fn(async () => ({ results: [] })),
  popular: vi.fn(async () => ({ results: [] })),
  rankings: vi.fn(async () => ({ result: { lists: {} } })),
}));
vi.mock('../lib/api', () => ({ fetchRecent: sources.recent, fetchPopular: sources.popular, fetchPopularSeries: sources.rankings }));
vi.mock('../lib/metadata', () => ({ getHomepage: sources.home }));
import { getHomeData } from '../lib/home';

it('shares one homepage assembly across concurrent requests and returns the cached snapshot', async () => {
  const [first, second] = await Promise.all([getHomeData(), getHomeData()]);
  expect(second).toBe(first);
  expect(await getHomeData()).toBe(first);
  for (const source of Object.values(sources)) expect(source).toHaveBeenCalledOnce();
});
