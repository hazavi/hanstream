import 'server-only';
import { fetchPopular, fetchPopularSeries, fetchRecent } from './api';
import { getHomepage } from './metadata';
import { createRuntimeCache } from './runtime-cache';
import { persistentLoader } from './persistent-cache';
import type { RecentItem, PopularItem, TopDramasResponse } from './api-types';

type HomeData = { home: Awaited<ReturnType<typeof getHomepage>>; recent: RecentItem[]; popular: PopularItem[]; rankings: TopDramasResponse['result']; partial: boolean };

/** Share one successful homepage refresh across simultaneous browser requests. */
const loadHome = persistentLoader<HomeData>('home', async (_key, previous) => {
  const [home, recent, popular, rankings] = await Promise.allSettled([
    getHomepage(), fetchRecent(), fetchPopular(), fetchPopularSeries(),
  ]);
  if ([home, recent, popular, rankings].every(result => result.status === 'rejected') && !previous) throw new Error('Homepage temporarily unavailable');
  return {
    home: home.status === 'fulfilled' ? home.value : previous?.home || { reviews: [], trending: [], starting: [], ending: [] },
    recent: recent.status === 'fulfilled' ? recent.value.results.slice(0, 12) : previous?.recent || [],
    popular: popular.status === 'fulfilled' ? popular.value.results.slice(0, 12) : previous?.popular || [],
    rankings: rankings.status === 'fulfilled' ? rankings.value.result : previous?.rankings || { lists: { airing: [], upcoming: [], popular: [] }, errors: { airing: 'Drama listings are temporarily unavailable.', upcoming: 'Drama listings are temporarily unavailable.' } },
    partial: [home, recent, popular, rankings].some(result => result.status === 'rejected'),
  };
}, value => Boolean(value?.home && value?.rankings && !value.partial && Array.isArray(value.recent) && Array.isArray(value.popular)), 30_000);
export const getHomeData = createRuntimeCache<HomeData>(previous => loadHome('home', previous), value => value.partial ? 10_000 : 30_000, value => !value.partial);
