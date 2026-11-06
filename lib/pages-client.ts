import type { SearchResponse } from "./api-types";
import { pagesRoute } from "./pages-routes";
import { detailNeedsRefresh, mergeDramaResponse } from './detail-cache';
import type { DramaResponse } from './api-types';
import { readLocalResponse, storeLocalResponse } from './client-cache';
import { hasHomeContent, mergeHomeData, type HomeData } from './home-data';
import { BackendRequestError } from './request-retry';
import { isPlaybackResponse } from './playback-response';

const responses = new Map<string, { expires: number; staleUntil: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();
const listeners = new Map<string,Set<()=>void>>();
export function subscribeBackend(path:string,listener:()=>void) {
  const key=address(path),group=listeners.get(key)||new Set<()=>void>();
  group.add(listener);listeners.set(key,group);
  return ()=>{group.delete(listener);if(!group.size)listeners.delete(key);};
}
function notify(key:string) { listeners.get(key)?.forEach(listener=>listener()); }
let generation = 0;
let waking:Promise<void>|undefined;
function wakeBackend() {
  if (!waking) waking=fetch(address('/api/health'),{signal:AbortSignal.timeout(40_000),credentials:'omit',cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('The catalog service could not start. Please retry shortly.');}).finally(()=>{waking=undefined;});
  return waking;
}
export function clearBackendCache() { generation++; responses.clear(); pending.clear(); }
function address(path: string) { return (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '') + path; }
export function peekBackend<T>(path: string): T | undefined {
  const saved = responses.get(address(path));
  return saved && saved.staleUntil > Date.now() ? saved.value as T : undefined;
}

function forConsumer<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return request;
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || new DOMException('Request aborted', 'AbortError'));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, {once:true});
    request.then(value => { signal.removeEventListener('abort', abort); resolve(value); }, error => { signal.removeEventListener('abort', abort); reject(error); });
  });
}

export async function readBackend<T>(path: string, signal?: AbortSignal, options: {fresh?:boolean;sameOrigin?:boolean} = {}): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base && !options.sameOrigin) throw new Error("The site connection has not been configured.");
  if (signal?.aborted) throw signal.reason || new DOMException("Request aborted", "AbortError");
  const key = address(path);
  let saved = responses.get(key);
  if (!options.fresh && saved && saved.expires > Date.now()) return saved.value as T;
  const search = path.startsWith('/api/search');
  const episode = path.startsWith('/api/episode/');
  const drama = path.startsWith('/api/drama/');
  const load = () => {
    const existing = pending.get(key);
    if (!search && existing) return existing;
    const timeout = AbortSignal.timeout(search ? 30_000 : 90_000);
    const started = generation;
    const requestSignal = search && signal ? AbortSignal.any([signal, timeout]) : timeout;
    const fetchCurrent=(uncached=false)=>fetch(key,{signal:AbortSignal.any([requestSignal,AbortSignal.timeout(search?8000:15000)]),credentials:'omit',...(uncached?{cache:'no-store' as const}:{})});
    const request = (async () => {
      if (!search && !episode && !saved && !options.fresh) {
        let cacheTimer:ReturnType<typeof setTimeout>|undefined;
        let cacheSlow=false;
        const localRequest=readLocalResponse(key);
        const local = await Promise.race([localRequest,new Promise<undefined>(resolve=>{cacheTimer=setTimeout(()=>{cacheSlow=true;resolve(undefined);},300);})]).finally(()=>clearTimeout(cacheTimer));
        if(cacheSlow) void localRequest.then(record=>{
          if(!record || record.expires<=Date.now() || generation!==started)return;
          const current=responses.get(key);
          if(current && !(path==='/api/home'&&(current.value as HomeData)?.partial) && !(drama&&detailNeedsRefresh(current.value as DramaResponse)))return;
          const value=current ? drama?mergeDramaResponse(record.value as DramaResponse,current.value as DramaResponse):path==='/api/home'?mergeHomeData(record.value as HomeData,current.value as HomeData):current.value : record.value;
          saved={value,expires:current?.expires || record.savedAt,staleUntil:record.expires};
          responses.set(key,saved);notify(key);
        }).catch(()=>{});
        if (local && local.expires > Date.now()) {
          saved = {value:local.value,expires:Math.min(local.expires,local.savedAt+(drama ? 300_000 : 30_000)),staleUntil:local.expires};
          responses.set(key,saved);
          notify(key);
          if (saved.expires <= Date.now()) setTimeout(() => {
            if (generation===started) void readBackend(path,undefined,{fresh:true,sameOrigin:options.sameOrigin}).catch(()=>{});
          },0);
          return saved.value;
        }
      }
      try {
      let response:Response;
      try { response=await fetchCurrent(); }
      catch(error) {
        if(!base || search || !['TimeoutError','AbortError'].includes((error as {name?:string})?.name || ''))throw error;
        await wakeBackend();
        response=await fetchCurrent();
      }
      if ([502,503,504].includes(response.status)) {
        await response.body?.cancel();
        await new Promise(resolve=>setTimeout(resolve,250));
        response = await fetchCurrent();
      }
      if (!response.ok) throw new BackendRequestError('Unable to load this page. Please try again.', !response.status || response.status >= 500 || response.status === 429);
      while (response.status === 202) {
        const seconds=Math.min(3,Math.max(1,Number(response.headers.get('retry-after'))||2));
        await response.body?.cancel();
        await new Promise<void>((resolve,reject)=>{
          const abort=()=>{clearTimeout(timer);reject(requestSignal.reason);};
          const timer=setTimeout(()=>{requestSignal.removeEventListener('abort',abort);resolve();},seconds*1000);
          if(requestSignal.aborted)abort();else requestSignal.addEventListener('abort',abort,{once:true});
        });
        response=await fetchCurrent(true);
        if(!response.ok)throw new BackendRequestError('The catalog reader could not load this request. Please retry shortly.', response.status >= 500 || response.status === 429);
      }
      const raw = await response.json();
      if (episode && !isPlaybackResponse(raw)) throw new BackendRequestError('The episode is still loading.');
      const value = drama ? mergeDramaResponse(saved?.value as DramaResponse | undefined, raw) : path==='/api/home' ? mergeHomeData(saved?.value as HomeData|undefined,raw) : raw;
      const partial = path === '/api/home' && value?.partial === true;
      const ttl = drama ? detailNeedsRefresh(value) ? 15_000 : 300_000 : partial ? 10_000 : 30_000;
      if (generation===started && (!episode || value?.result?.video)) {
        responses.delete(key);
        const durable = !search && !episode && (path==='/api/home'?hasHomeContent(value):!partial&&!(drama&&detailNeedsRefresh(value)));
        const record = {value,expires:Date.now()+ttl,staleUntil:Date.now()+(durable?86_400_000:ttl)};
        responses.set(key, record);
        notify(key);
        if (durable) void storeLocalResponse({key,value,expires:record.staleUntil,savedAt:Date.now()});
      }
      if (responses.size > 50) responses.delete(responses.keys().next().value!);
      return value;
      } catch (error) {
        if (!search && !episode && saved && saved.staleUntil > Date.now()) return saved.value;
        if ((error as { name?: string })?.name === 'TimeoutError')
          throw new Error('The catalog is taking longer than expected. Please try again shortly.');
        throw error;
      }
    })();
    if (!search) {
      pending.set(key,request);
      void request.finally(()=>{if(pending.get(key)===request)pending.delete(key);}).catch(()=>{});
    }
    return request;
  };
  if (!options.fresh && !search && !episode && saved && saved.staleUntil > Date.now()) {
    void load().catch(()=>{});
    return saved.value as T;
  }
  return forConsumer(load() as Promise<T>, signal);
}
export async function fetchSearchClient(query: string, page = 1, signal?: AbortSignal): Promise<SearchResponse> {
  const data = await readBackend<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}&page=${page}`, signal);
  return { results: data.results.map(item => ({ ...item, "detail-link": pagesRoute(item["detail-link"]) })) };
}
