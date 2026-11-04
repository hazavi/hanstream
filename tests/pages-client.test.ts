import { afterEach, expect, it, vi } from "vitest";
import { clearBackendCache, fetchSearchClient, readBackend } from "../lib/pages-client";
afterEach(() => { clearBackendCache(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it("calls the configured backend with an abort signal and no cookies", async () => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://backend.example/");
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) });
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  expect(await readBackend("/api/health", signal)).toEqual({ status: "ok" });
  expect(fetch).toHaveBeenCalledWith("https://backend.example/api/health", { signal: expect.any(AbortSignal), credentials: "omit" });
});

it('coalesces a detail request without letting one aborted view cancel another', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL','https://coalesced.example');
  let release!: (response:unknown)=>void;
  const fetch=vi.fn(()=>new Promise(resolve=>{release=resolve;})); vi.stubGlobal('fetch',fetch);
  const controller=new AbortController();
  const first=readBackend('/api/drama/shared',controller.signal);
  const rejection=expect(first).rejects.toThrow();
  const second=readBackend('/api/drama/shared');
  controller.abort();
  release({ok:true,json:async()=>({result:{title:'Drama',description:'Story',image:'https://pictures.example/poster.jpg'}})});
  await rejection;
  expect((await second as {result:{title:string}}).result.title).toBe('Drama');
  expect(fetch).toHaveBeenCalledOnce();
});

it('serves a good cached detail immediately during revalidation and preserves it through source outages', async () => {
  vi.useFakeTimers(); vi.stubEnv('NEXT_PUBLIC_API_BASE_URL','https://stale.example');
  const detail={result:{title:'Drama',description:'Published summary',image:'https://pictures.example/poster.jpg',episodes:[{episode:1,episode_link:'/drama/episode/1'}]}};
  const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>detail}).mockResolvedValueOnce({ok:true,json:async()=>({result:{title:'Drama',description:'',image:'/file.svg',episodes:[],detailsUnavailable:true}})});
  vi.stubGlobal('fetch',fetch);
  await readBackend('/api/drama/stale');
  await vi.advanceTimersByTimeAsync(300_001);
  expect(await readBackend('/api/drama/stale')).toEqual(detail);
  await vi.advanceTimersByTimeAsync(0);
  const recovered=await readBackend<typeof detail>('/api/drama/stale');
  expect(recovered.result.description).toBe(detail.result.description);
  expect(recovered.result.episodes).toEqual(detail.result.episodes);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('retries a temporary gateway failure once and keeps the request bounded', async () => {
  vi.useFakeTimers(); vi.stubEnv('NEXT_PUBLIC_API_BASE_URL','https://waking.example');
  const fetch=vi.fn().mockResolvedValueOnce({ok:false,status:503}).mockResolvedValueOnce({ok:true,json:async()=>({status:'ready'})});vi.stubGlobal('fetch',fetch);
  const result=readBackend('/api/health');
  await vi.advanceTimersByTimeAsync(250);
  expect(await result).toEqual({status:'ready'});
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("maps search suggestions to static detail routes", async () => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://backend.example");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ title: "A Show", image: "/file.svg", "detail-link": "/drama-a-show--2026" }] }) }));
  expect((await fetchSearchClient("a show")).results[0]["detail-link"]).toBe("/drama/?id=drama-a-show--2026");
});
it("reuses recent successful data and never returns it to an aborted request", async () => {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://cache.example');
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ title: 'Drama' }) });
  vi.stubGlobal('fetch', fetch);
  await readBackend('/api/drama/fixture');
  expect(await readBackend('/api/drama/fixture')).toEqual({ title: 'Drama' });
  expect(fetch).toHaveBeenCalledTimes(1);
  const controller = new AbortController(); controller.abort();
  await expect(readBackend('/api/drama/fixture', controller.signal)).rejects.toThrow();
});
it("shows a readable failure for a missing configuration or unavailable service", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
  await expect(readBackend("/api/home")).rejects.toThrow("not been configured");
  expect(fetch).not.toHaveBeenCalled();
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://backend.example");
  fetch.mockResolvedValue({ ok: false });
  await expect(readBackend("/api/home")).rejects.toThrow("Please try again");
});
