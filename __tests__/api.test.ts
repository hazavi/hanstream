// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDrama, fetchEpisode, fetchSearch, fetchRecent, fetchPopularSeries } from "../lib/api";
import { findDramaDetails, getDetailEpisodes } from "../lib/details";
import { getPlaybackCatalog, getPlaybackEpisodes, getPlaybackStream } from "../lib/playback";
import { enrichArtwork, getMetadataList, searchMetadata, findMetadata } from "../lib/metadata";

vi.mock("../lib/details", () => ({ findDramaDetails: vi.fn(), getDramaDetails: vi.fn(), getDetailEpisodes: vi.fn() }));
vi.mock("../lib/playback", () => ({ getPlaybackCatalog: vi.fn(), getPlaybackEpisodes: vi.fn(), getPlaybackStream: vi.fn() }));
vi.mock("../lib/metadata", () => ({ findMetadata: vi.fn(), enrichArtwork: vi.fn(), getMetadataList: vi.fn(), searchMetadata: vi.fn(), getHomepage: vi.fn() }));

const title = { sourceName: "Fixture catalog", title: "Fixture Drama", year: 2026, image: "/file.svg", url: "https://details.example/tv/42/fixture-drama", movie: false, country: "Korea (KR)", meta: { Released: 2026 } };

describe("HTML source data mapping", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(findMetadata).mockResolvedValue(null);
    vi.mocked(enrichArtwork).mockImplementation(async items => items);
    vi.mocked(findDramaDetails).mockResolvedValue(title);
    vi.mocked(getDetailEpisodes).mockResolvedValue([]);
    vi.mocked(getPlaybackEpisodes).mockResolvedValue([]);
    vi.mocked(getPlaybackStream).mockResolvedValue(null);
  });

  it("keeps season-aware links from the detail source", async () => {
    vi.mocked(getDetailEpisodes).mockResolvedValue([{ title: "Pilot", season: 1, episode: 1 }, { title: "Season two", season: 2, episode: 1 }]);
    const result = await fetchDrama("drama-fixture-drama--2026");
    expect(result.result?.episodes?.map(ep => ep.episode_link)).toEqual(["/drama-fixture-drama--2026/episode/s1e1", "/drama-fixture-drama--2026/episode/s2e1"]);
    expect(result.result).not.toHaveProperty("sourceUrl");
  });

  it("keeps verified playback entries when the detail source is blocked", async () => {
    vi.mocked(findDramaDetails).mockRejectedValue(new Error("Blocked"));
    vi.mocked(getPlaybackEpisodes).mockResolvedValue([{ ...title, url: "https://stream.example/embed/fixture-drama-2026-ep-2.html", episode: 2 }]);
    const result = await fetchDrama("drama-fixture-drama--2026");
    expect(result.result?.detailsUnavailable).toBe(true);
    expect(result.result?.description).toBeUndefined();
    expect(result.result?.title).toBe("Fixture Drama");
    expect(result.result?.episodes?.[0].episode).toBe(2);
  });

  it("loads alternative drama details without requesting a blocked primary source", async () => {
    vi.mocked(findMetadata).mockResolvedValue({ ...title, sourceName: "Metadata", url: "https://metadata.example/Fixture_Drama", overview: "Published drama facts." });
    const result = await fetchDrama("drama-fixture-drama--2026");
    expect(result.result).not.toHaveProperty("metadataSource");
    expect(result.result?.description).toBe("Published drama facts.");
    expect(result.result?.detailsUnavailable).toBe(false);
    expect(findDramaDetails).not.toHaveBeenCalled();
    expect(getDetailEpisodes).not.toHaveBeenCalled();
  });

  it("passes season and year to the playback source and retains alternative servers", async () => {
    vi.mocked(getPlaybackStream).mockResolvedValue({ url: "https://player-one.example/embed/1", pageUrl: "https://stream.example/embed/fixture.html", servers: [{ name: "Primary Player", url: "https://player-one.example/embed/1" }] });
    const result = await fetchEpisode("drama-fixture-drama--2026", "s2e1");
    expect(getPlaybackStream).toHaveBeenCalledWith("Fixture Drama", "1", false, 2026, 2);
    expect(result.result.servers).toHaveLength(1);
    expect(result.result).not.toHaveProperty("sourcePage");
    expect(result.result.servers?.[0].name).toBe("Server 1");
  });

  it("does not offer an invented stream when the provider fails", async () => {
    vi.mocked(getPlaybackStream).mockRejectedValue(new Error("Unavailable"));
    expect((await fetchEpisode("drama-fixture-drama--2026", "s1e1")).result.video).toBe("");
  });

  it("rejects malformed episodes before contacting a source", async () => {
    await expect(fetchEpisode("drama-fixture-drama--2026", "../../etc/passwd")).rejects.toThrow("Invalid episode");
    expect(getPlaybackStream).not.toHaveBeenCalled();
  });

  it("uses an Asian catalog for search even when metadata search is unavailable", async () => {
    vi.mocked(searchMetadata).mockRejectedValue(new Error("Blocked"));
    vi.mocked(getPlaybackCatalog).mockResolvedValue([{ ...title, episode: 1 }, { ...title, episode: 2 }]);
    expect((await fetchSearch("Fixture Drama")).results).toEqual([{ title: "Fixture Drama", image: "/file.svg", "detail-link": "/drama-fixture-drama--2026" }]);
  });

  it("uses actual latest episode numbers instead of pretending every row is episode one", async () => {
    vi.mocked(getPlaybackCatalog).mockResolvedValue([{ ...title, episode: 14 }, { ...title, movie: true }]);
    const result = await fetchRecent();
    expect(result.results).toHaveLength(1);
    expect(result.results[0]["episode-link"]).toBe("/drama-fixture-drama--2026/episode/s1e14");
  });

  it("keeps each ranking category independent when one source page fails", async () => {
    vi.mocked(getMetadataList).mockImplementation(async kind => { if (kind === "upcoming") throw new Error("Blocked"); return [title]; });
    const result = await fetchPopularSeries();
    expect(result.result.lists.airing).toHaveLength(1);
    expect(result.result.lists.popular).toHaveLength(1);
    expect(result.result.lists.upcoming).toEqual([]);
    expect(result.result.errors.upcoming).toContain("temporarily unavailable");
  });
});
