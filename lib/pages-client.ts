import type { SearchResponse } from "./api-types";
import { pagesRoute } from "./pages-routes";
import { detailNeedsRefresh, mergeDramaResponse } from './detail-cache';
import type { DramaResponse } from './api-types';
import { readLocalResponse, storeLocalResponse } from './client-cache';

const responses = new Map<string, { expires: number; staleUntil: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();
let generation = 0;
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
    const timeout = AbortSignal.timeout(search ? 8000 : drama ? 25000 : 15000);
    const started = generation;
    const requestSignal = search && signal ? AbortSignal.any([signal, timeout]) : timeout;
    const request = (async () => {
      if (!search && !episode && !saved && !options.fresh) {
        const local = await readLocalResponse(key);
        if (local && local.expires > Date.now()) {
          saved = {value:local.value,expires:Math.min(local.expires,local.savedAt+30_000),staleUntil:local.expires};
          responses.set(key,saved);
          if (saved.expires > Date.now()) return saved.value;
        }
      }
      try {
      let response = await fetch(key, {signal:requestSignal,credentials:'omit'});
      if ([502,503,504].includes(response.status)) {
        await response.body?.cancel();
        await new Promise(resolve=>setTimeout(resolve,250));
        response = await fetch(key, {signal:requestSignal,credentials:'omit'});
      }
      if (!response.ok) throw new Error('Unable to load this page. Please try again.');
      const raw = await response.json();
      const value = drama ? mergeDramaResponse(saved?.value as DramaResponse | undefined, raw) : raw;
      const partial = path === '/api/home' && value?.partial === true;
      const ttl = drama ? detailNeedsRefresh(value) ? 15_000 : 300_000 : partial ? 10_000 : 30_000;
      if (generation===started && (!episode || value?.result?.video)) {
        responses.delete(key);
        const record = {value,expires:Date.now()+ttl,staleUntil:Date.now()+ttl+(search || episode || partial || drama && detailNeedsRefresh(value) ? 0 : 900_000)};
        responses.set(key, record);
        if (!search && !episode && !partial && !(drama && detailNeedsRefresh(value))) void storeLocalResponse({key,value,expires:record.staleUntil,savedAt:Date.now()});
      }
      if (responses.size > 50) responses.delete(responses.keys().next().value!);
      return value;
      } catch (error) {
        if (!search && !episode && saved && saved.staleUntil > Date.now()) return saved.value;
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
