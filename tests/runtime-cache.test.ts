// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { createRuntimeCache, createKeyedCache, createKeyedStaleCache } from "../lib/runtime-cache";

afterEach(() => { vi.useRealTimers(); });

it("coalesces concurrent cold requests and caches only the loaded result", async () => {
  let finish!: (value: string[]) => void;
  const load = vi.fn(() => new Promise<string[]>(resolve => { finish = resolve; }));
  const read = createRuntimeCache(load, 1000);
  const one = read(), two = read();
  finish(["live title"]);
  expect(await one).toEqual(["live title"]);
  expect(await two).toEqual(["live title"]);
  expect(await read()).toEqual(["live title"]);
  expect(load).toHaveBeenCalledTimes(1);
});

it('shares assembled detail reads, preserves stale success, and can reset between sessions', async () => {
  vi.useFakeTimers();
  const load=vi.fn().mockResolvedValueOnce({title:'Published detail'}).mockRejectedValueOnce(new Error('source outage')).mockResolvedValueOnce({title:'Recovered detail'});
  const read=createKeyedStaleCache(load,1000);
  const [one,two]=await Promise.all([read('show'),read('show')]);
  expect(one).toBe(two); expect(load).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1001);
  expect(await read('show')).toEqual(one);
  await vi.advanceTimersByTimeAsync(0);
  expect(await read('show')).toEqual(one);
  read.clear(); expect(await read('show')).toEqual({title:'Recovered detail'});
});

it('waits for a partial detail to recover after its short expiry instead of serving it stale', async () => {
  vi.useFakeTimers();
  let finish!: (value:{complete:boolean})=>void;
  const load=vi.fn().mockResolvedValueOnce({complete:false}).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const read=createKeyedStaleCache<{complete:boolean}>(load,value=>value.complete?300_000:1000,100,value=>value.complete);
  await read('show'); await vi.advanceTimersByTimeAsync(1001);
  let done=false; const refreshed=read('show').then(value=>{done=true;return value;});
  expect(done).toBe(false); finish({complete:true});
  expect(await refreshed).toEqual({complete:true});
});

it("refreshes expired live data in the background and retains it during an outage", async () => {
  vi.useFakeTimers();
  const load = vi.fn().mockResolvedValueOnce(["first"]).mockResolvedValueOnce(["fresh"]).mockRejectedValueOnce(new Error("offline"));
  const read = createRuntimeCache<string[]>(load, 1000);
  expect(await read()).toEqual(["first"]);
  await vi.advanceTimersByTimeAsync(1001);
  expect(await read()).toEqual(["first"]);
  await vi.advanceTimersByTimeAsync(0);
  expect(await read()).toEqual(["fresh"]);
  expect(load).toHaveBeenNthCalledWith(2, ["first"]);
  await vi.advanceTimersByTimeAsync(1001);
  expect(await read()).toEqual(["fresh"]);
  await vi.advanceTimersByTimeAsync(0);
  expect(await read()).toEqual(["fresh"]);
});

it("reports cold-start failures instead of returning bundled fallback data", async () => {
  const read = createRuntimeCache(async () => { throw new Error("offline"); }, 1000);
  await expect(read()).rejects.toThrow("offline");
});
it("shares concurrent per-title reads, expires misses quickly, and bounds retained titles", async () => {
  vi.useFakeTimers();
  const load = vi.fn(async (key: string) => key === 'missing' ? null : key);
  const read = createKeyedCache(load, 60_000, 2);
  expect(await Promise.all([read('first'),read('first')])).toEqual(['first','first']);
  expect(load).toHaveBeenCalledTimes(1);
  await read('missing'); await read('missing');
  expect(load).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(30_001);
  await read('missing'); expect(load).toHaveBeenCalledTimes(3);
  await read('third'); await read('first'); expect(load).toHaveBeenCalledTimes(5);
});
