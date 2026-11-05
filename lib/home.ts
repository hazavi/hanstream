import 'server-only';
import { fetchPopular, fetchPopularSeries, fetchRecent } from './api';
import { getHomepage } from './metadata';
import { createRuntimeCache } from './runtime-cache';
import { persistentLoader } from './persistent-cache';
import type { RecentItem, PopularItem, TopDramasResponse } from './api-types';
import {mergeHomeData} from './home-data';

type HomeData = { home: Awaited<ReturnType<typeof getHomepage>>; recent: RecentItem[]; popular: PopularItem[]; rankings: TopDramasResponse['result']; partial: boolean };
type Slot<T> = { result?: PromiseSettledResult<T> };

/** Share one successful homepage refresh across simultaneous browser requests. */
const loadHome = persistentLoader<HomeData>('home', async (_key, previous) => {
  const home:Slot<Awaited<ReturnType<typeof getHomepage>>>={};
  const recent:Slot<Awaited<ReturnType<typeof fetchRecent>>>={};
  const popular:Slot<Awaited<ReturnType<typeof fetchPopular>>>={};
  const rankings:Slot<Awaited<ReturnType<typeof fetchPopularSeries>>>={};
  let delivered=false;
  function snapshot():HomeData {
    const states=[home.result,recent.result,popular.result,rankings.result];
    if(states.every(state=>state?.status==='rejected')&&!previous)throw new Error('Homepage temporarily unavailable');
    const result=rankings.result?.status==='fulfilled'?rankings.result.value.result:previous?.rankings || {lists:{airing:[],upcoming:[],popular:[]},errors:{airing:'Drama listings are loading.',upcoming:'Drama listings are loading.'}};
    return mergeHomeData(previous,{
      home:home.result?.status==='fulfilled'?home.result.value:previous?.home || {reviews:[],trending:[],starting:[],ending:[]},
      recent:recent.result?.status==='fulfilled'?recent.result.value.results.slice(0,12):previous?.recent || [],
      popular:popular.result?.status==='fulfilled'?popular.result.value.results.slice(0,12):previous?.popular || [],
      rankings:result,
      partial:states.some(state=>!state || state.status==='rejected') || Object.keys(result.errors||{}).length>0 || home.result?.status==='fulfilled' && home.result.value.reviews?.length===0,
    });
  }
  function observe<T>(request:Promise<T>,slot:Slot<T>) {
    return request.then(value=>{slot.result={status:'fulfilled',value};},reason=>{slot.result={status:'rejected',reason};}).then(()=>{
      if(delivered){try{const data=snapshot();getHomeData.prime(data);void loadHome.remember('home',data);}catch{/* Keep the last available snapshot. */}}
    });
  }
  const tasks=[observe(getHomepage(),home),observe(fetchRecent(),recent),observe(fetchPopular(),popular),observe(fetchPopularSeries(),rankings)];
  let timer:ReturnType<typeof setTimeout>|undefined;
  await Promise.race([Promise.all(tasks),new Promise<void>(resolve=>{timer=setTimeout(resolve,2500);})]).finally(()=>clearTimeout(timer));
  const result=snapshot();
  delivered=true;
  return result;
}, value => Boolean(value?.home && value?.rankings && !value.partial && Array.isArray(value.recent) && Array.isArray(value.popular)), 30_000);
export const getHomeData = createRuntimeCache<HomeData>(previous => loadHome('home', previous), value => value.partial ? 10_000 : 30_000, value => !value.partial);
