// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { createRuntimeCache, createKeyedCache } from "../lib/runtime-cache";

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
