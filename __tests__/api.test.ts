import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDrama, fetchEpisode, fetchSearch, fetchRecent } from "../lib/api";
import { getSimklDrama, getSimklEpisodes, simklGet } from "../lib/simkl";
import { getKisskhStream } from "../lib/kisskh";

vi.mock("../lib/simkl", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/simkl")>();
  return { ...original, getSimklDrama: vi.fn(), getSimklEpisodes: vi.fn(), simklGet: vi.fn() };
});
vi.mock("../lib/kisskh", () => ({ getKisskhStream: vi.fn() }));

describe("Simkl and kisskh data mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SIMKL_CLIENT_ID = "test-client";
  });

  it("maps Simkl details and season-aware episode links", async () => {
    vi.mocked(getSimklDrama).mockResolvedValue({ title: "Test Drama", poster: "12/poster", overview: "Story", ids: { simkl: 42, slug: "test-drama" }, year: 2026 });
    vi.mocked(getSimklEpisodes).mockResolvedValue([{ title: "Pilot", season: 1, episode: 1, aired: true }, { title: "Second season", season: 2, episode: 1, aired: true }]);
    const result = await fetchDrama("42");
    expect(result.result?.title).toBe("Test Drama");
    expect(result.result?.simklUrl).toBe("https://simkl.com/tv/42/test-drama");
    expect(result.result?.episodes?.map((episode) => episode.episode_link)).toEqual(["/42/episode/s1e1", "/42/episode/s2e1"]);
  });

  it("uses only a kisskh stream for playback", async () => {
    vi.mocked(getSimklDrama).mockResolvedValue({ title: "Test Drama", ids: { simkl: 42 } });
    vi.mocked(getSimklEpisodes).mockResolvedValue([{ title: "Pilot", season: 1, episode: 1, aired: true }]);
    vi.mocked(getKisskhStream).mockResolvedValueOnce({ url: "https://vidmoly.example/embed/1", pageUrl: "https://kisskh.space/test-drama-ep-1/" }).mockResolvedValueOnce(null);
    expect((await fetchEpisode("42", "s1e1")).result.video).toBe("https://vidmoly.example/embed/1");
    expect((await fetchEpisode("42", "s1e1")).result.video).toBe("");
    expect(getKisskhStream).toHaveBeenCalledWith("Test Drama", "1", false);
  });

  it("maps Simkl search results to stable local routes", async () => {
    vi.mocked(simklGet).mockResolvedValueOnce([{ title: "Drama", ids: { simkl_id: 42 } }]).mockResolvedValueOnce([{ title: "Movie", ids: { simkl_id: 88 } }]);
    const result = await fetchSearch("drama");
    expect(result.results.map((item) => item["detail-link"])).toEqual(["/42", "/movie-88"]);
  });

  it("loads trending TV from Simkl CDN", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [{ title: "Drama", ids: { simkl_id: 42 } }] }));
    const result = await fetchRecent();
    expect(result.results[0]["episode-link"]).toBe("/42");
    expect(vi.mocked(fetch).mock.calls[0][0].toString()).toContain("data.simkl.in/discover/trending/tv/today_100.json");
    vi.unstubAllGlobals();
  });
});
