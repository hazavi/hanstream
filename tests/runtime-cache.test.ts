// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { createRuntimeCache } from "../lib/runtime-cache";

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
