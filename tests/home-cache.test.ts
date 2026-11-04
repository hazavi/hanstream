// @vitest-environment node
import { expect, it, vi } from 'vitest';
import type { RecentItem } from '../lib/api-types';
const sources = vi.hoisted(() => ({
  home: vi.fn(async () => ({ starting: [], ending: [] })),
  recent: vi.fn(async () => ({ results: [] as RecentItem[] })),
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
it('keeps available episodes when optional homepage metadata fails', async () => {
  vi.resetModules();
  sources.home.mockRejectedValueOnce(new Error('Source outage'));
  sources.recent.mockResolvedValueOnce({results:[{title:'Published',image:'https://pictures.example/poster.jpg','episode-link':'/drama-published--2026/episode/s1e1',episode_number:1,time:'Available now',type:'Drama'}]});
  const {getHomeData: read} = await import('../lib/home');
  const data = await read();
  expect(data.recent[0].title).toBe('Published');
  expect(data.home.starting).toEqual([]); expect(data.partial).toBe(true);
});
