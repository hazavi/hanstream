import 'server-only';
import { fetchPopular, fetchPopularSeries, fetchRecent } from './api';
import { getHomepage } from './metadata';
import { createRuntimeCache } from './runtime-cache';

/** Share one successful homepage refresh across simultaneous browser requests. */
export const getHomeData = createRuntimeCache(async () => {
  const [home, recent, popular, rankings] = await Promise.all([
    getHomepage(), fetchRecent(), fetchPopular(), fetchPopularSeries(),
  ]);
  return { home, recent: recent.results.slice(0, 12), popular: popular.results.slice(0, 12), rankings: rankings.result };
}, 30_000);
