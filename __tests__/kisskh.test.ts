import { afterEach, expect, it, vi } from "vitest";
import { getKisskhStream } from "../lib/kisskh";

afterEach(() => vi.unstubAllGlobals());

it("resolves a matching kisskh episode player and skips tracking iframes", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, text: async () => '<a href="https://kisskh.space/test-drama-ep-2/">Test Drama Ep 2</a>' })
    .mockResolvedValueOnce({ ok: true, text: async () => '<iframe src="https://www.googletagmanager.com/tracker"></iframe><iframe src="https://vidmoly.example/embed/2"></iframe>' });
  vi.stubGlobal("fetch", fetchMock);
  expect(await getKisskhStream("Test Drama", "2")).toEqual({ url: "https://vidmoly.example/embed/2", pageUrl: "https://kisskh.space/test-drama-ep-2/" });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("returns no stream for an unmatched episode", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "<html></html>" }));
  expect(await getKisskhStream("Test Drama", "2")).toBeNull();
});
