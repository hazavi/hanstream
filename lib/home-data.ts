import type { PopularItem, RecentItem, TopDramasResponse } from './api-types';
import type { CatalogTitle } from './catalog';

export type HomeData = {home:Record<'reviews'|'trending'|'starting'|'ending',CatalogTitle[]>;recent:RecentItem[];popular:PopularItem[];rankings:TopDramasResponse['result'];partial:boolean};

/** Preserve successful sections when one reader fails during a refresh. */
export function mergeHomeData(previous:HomeData|undefined,next:HomeData):HomeData {
  if (!previous) return next;
  const home={...next.home};
  for (const key of ['reviews','trending','starting','ending'] as const) {
    if(next.partial&&!home[key]?.length&&previous.home[key]?.length)home[key]=previous.home[key];
  }
  const lists={...next.rankings.lists},errors={...next.rankings.errors};
  for(const key of ['airing','upcoming','popular'] as const){
    if((errors[key]||next.partial)&&!lists[key]?.length&&previous.rankings.lists[key]?.length){lists[key]=previous.rankings.lists[key];delete errors[key];}
  }
  return {...next,home,rankings:{lists,errors},recent:next.recent.length?next.recent:next.partial?previous.recent:[],popular:next.popular.length?next.popular:next.partial?previous.popular:[]};
}

export function hasHomeContent(value:HomeData) {
  return Boolean(value?.recent?.length || value?.rankings?.lists?.airing?.length || value?.rankings?.lists?.upcoming?.length);
}
