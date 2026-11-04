import 'server-only';
import { fetchPopular, fetchPopularSeries, fetchRecent } from './api';
import { getHomepage } from './metadata';
import { createRuntimeCache } from './runtime-cache';
import { persistentLoader } from './persistent-cache';

/** Share one successful homepage refresh across simultaneous browser requests. */
const loadHome = persistentLoader('home', async () => {
  const [home, recent, popular, rankings] = await Promise.all([
    getHomepage(), fetchRecent(), fetchPopular(), fetchPopularSeries(),
  ]);
  return { home, recent: recent.results.slice(0, 12), popular: popular.results.slice(0, 12), rankings: rankings.result };
}, value => Boolean(value?.home && value?.rankings && Array.isArray(value.recent) && Array.isArray(value.popular)), 30_000);
export const getHomeData = createRuntimeCache(() => loadHome('home'), 30_000);
