// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { parsePlaybackCatalog, parsePlaybackPage, getPlaybackCatalog, getPlaybackStream } from "../lib/playback";
import { parseDetailPage, parseDetailEpisodes, isAsianCountry, findDramaDetails } from "../lib/details";
import { readHtml, sourceUrl } from "../lib/html";
import { catalogRoute, parseCatalogRoute } from "../lib/catalog";

// Keep parser tests isolated; runtime cache behavior is covered separately.
vi.mock("../lib/runtime-cache", () => ({ createRuntimeCache: (load: () => Promise<unknown>) => load }));
afterEach(() => vi.unstubAllGlobals());
const htmlResponse = (html: string) => new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
const catalog = '<a class="post-title-link" href="https://stream.example/embed/fixture-2026-ep-2.html">Fixture (2026) Ep 2</a><a class="post-title-link" href="https://stream.example/embed/fixture-2025-ep-2.html">Fixture (2025) Ep 2</a><a class="post-title-link" href="https://stream.example/embed/fixture-2026-ep-20.html">Fixture (2026) Ep 20</a>';

describe("Playback public HTML", () => {
  it("loads older episodes from discovered public pagination without a data file", async () => {
    const latest = '<a class="post-title-link" href="/embed/new.html">New Show (2026) Ep 3</a><a class="page-numbers" href="/list/2.html">2</a><a class="page-numbers" href="https://unlisted.example/list/999.html">999</a>';
    const mocked = vi.fn(async (address: string) => htmlResponse(address.endsWith('/list/2.html') ? '<a href="/embed/older.html">Older Show (2025) Ep 2</a>' : address.endsWith('/list/1.html') ? '<a href="/embed/oldest.html">Oldest Show (2024) Ep 1</a>' : latest));
    vi.stubGlobal("fetch", mocked);
    const items = await getPlaybackCatalog();
    expect(items.map(item => item.title)).toEqual(["New Show", "Older Show", "Oldest Show"]);
    expect(mocked.mock.calls.map(([address]) => address).sort()).toEqual(["https://stream.example/", "https://stream.example/list/1.html", "https://stream.example/list/2.html"].sort());
  });
  it("reads episode suffixes, movies, years, and HTML entities", () => {
    const items = parsePlaybackCatalog(catalog + '<a href="/embed/the-moon.html">The Moon (2023) Full Korean Movie</a><a href="/embed/heart.html">A Parasite’s Heart (2026) Episode 23</a>');
    expect(items[0]).toMatchObject({ title: "Fixture", year: 2026, episode: 2 });
    expect(items[3]).toMatchObject({ title: "The Moon", year: 2023, movie: true });
    expect(items[4]).toMatchObject({ title: "A Parasite’s Heart", episode: 23 });
  });

  it("reads real lazy-player attributes and skips unrelated iframes", () => {
    const stream = parsePlaybackPage('<iframe src="https://google.example/tracker"></iframe><li class="server-item active" data-video="https://player-one.example/embed-fixture.html">Primary Player<span></span></li><li class="server-item" data-video="https://player-two.example/e/fixture">Alternate Player</li><iframe id="embedvideo" data-src="https://player-one.example/embed-fixture.html"></iframe>', "https://stream.example/embed/fixture.html");
    expect(stream?.url).toBe("https://player-one.example/embed-fixture.html");
    expect(stream?.servers.map(server => server.name)).toEqual(["Primary Player", "Alternate Player"]);
  });

  it("does not match the wrong year or episode twenty for episode two", async () => {
    const mocked = vi.fn().mockResolvedValueOnce(htmlResponse(catalog)).mockResolvedValueOnce(htmlResponse('<iframe id="embedvideo" data-src="https://player-one.example/embed-fixture.html"></iframe>'));
    vi.stubGlobal("fetch", mocked);
    await getPlaybackStream("Fixture", "2", false, 2025);
    expect(mocked.mock.calls[1][0]).toBe("https://stream.example/embed/fixture-2025-ep-2.html");
  });

  it("never uses season one when season two is requested", async () => {
    const mocked = vi.fn().mockResolvedValue(htmlResponse(catalog));
    vi.stubGlobal("fetch", mocked);
    expect(await getPlaybackStream("Fixture", "2", false, 2026, 2)).toBeNull();
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it("returns unavailable for a preparing player or unsafe player URL", () => {
    expect(parsePlaybackPage('<div class="preparing">Video is being prepared</div>', "https://stream.example/embed/fixture.html")).toBeNull();
    expect(parsePlaybackPage('<iframe id="embedvideo" data-src="javascript:alert(1)"></iframe>', "https://stream.example/embed/fixture.html")).toBeNull();
  });
});

describe("Details public HTML", () => {
  const detail = '<h1 itemprop="name">Moving</h1><h2 itemprop="alternateName">무빙</h2><img id="detailPosterImg" src="//poster.example/posters/fixture_m.webp"><meta property="og:url" content="https://details.example/tv/1810575/moving"><meta property="og:release_date" content="2023-08-09"><meta property="og:description" content="A fixture synopsis"><span itemprop="genre">Drama</span><a href="/tv/1810575/moving/episodes/">20 episodes</a><table><tr><td class="SimklTVAboutTabsDetails"><table><tr><td><strong>Country:</strong></td><td>Korea (KR)</td></tr><tr><td>Language:</td><td>Korean</td></tr></table></td></tr></table>';

  it("uses verified metadata selectors for title, original title, cover, country and synopsis", () => {
    expect(parseDetailPage(detail, "https://details.example/tv/1810575/moving")).toMatchObject({ title: "Moving", otherNames: "무빙", year: 2023, overview: "A fixture synopsis", image: "https://poster.example/posters/fixture_m.webp", meta: { Country: "Korea (KR)", Episodes: 20, Genre: "Drama" } });
  });

  it("does not admit a Western show into the drama catalog", () => {
    expect(isAsianCountry("United States (US)")).toBe(false);
    expect(() => parseDetailPage(detail.replace("Korea (KR)", "United States (US)"), "https://details.example/tv/42/fixture")).toThrow("outside the Asian drama catalog");
  });

  it("resolves a title from public catalog HTML when search requires JavaScript", async () => {
    const mocked = vi.fn()
      .mockResolvedValueOnce(htmlResponse('<div id="SearchWrapper"><input id="SearchKeyword"></div>'))
      .mockResolvedValueOnce(htmlResponse('<ul><li><table class="rightPostersContainer"><tr><td><a href="/tv/1810575/moving"><img alt="Moving" src="//poster.example/posters/fixture.webp"></a></td></tr></table></li></ul>'))
      .mockResolvedValueOnce(htmlResponse('<main>No matching title</main>'))
      .mockResolvedValueOnce(htmlResponse(detail));
    vi.stubGlobal("fetch", mocked);
    expect((await findDramaDetails("Moving", 2023))?.title).toBe("Moving");
    expect(mocked.mock.calls[3][0]).toBe("https://details.example/tv/1810575/moving");
  });

  it("deduplicates episode links and excludes specials, future episodes, and another series", () => {
    const row = (path: string, date = "") => `<div data-date="${date}"><a href="${path}"></a><span class="SimklTVEpisodesEpTitle">Pilot</span></div>`;
    const html = `<div id="tvShowInfoBlock">${row('/tv/42/fixture/season-1/episode-1/')}${row('/tv/42/fixture/season-1/episode-1/')}${row('/tv/42/fixture/season-2/episode-1/')}${row('/tv/42/fixture/season-0/episode-1/')}${row('/tv/42/fixture/season-1/episode-2/', '2099-01-01')}${row('/tv/43/another/season-1/episode-1/')}</div>`;
    expect(parseDetailEpisodes(html, "https://details.example/tv/42/fixture/episodes/")).toEqual([{ title: "Pilot", season: 1, episode: 1, date: undefined }, { title: "Pilot", season: 2, episode: 1, date: undefined }]);
  });
});

describe("Source URL and routing boundaries", () => {
  it("retains year and title identity without API IDs", () => {
    const route = catalogRoute({ title: "A Parasite’s Heart", year: 2026 });
    expect(parseCatalogRoute(route.slice(1))).toEqual({ title: "a parasites heart", year: 2026, movie: false });
  });

  it("does not fetch arbitrary hosts or follow a redirect to them", async () => {
    const mocked = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/private" } }));
    vi.stubGlobal("fetch", mocked);
    await expect(readHtml("https://example.com/" )).rejects.toThrow("Invalid source URL");
    expect(mocked).not.toHaveBeenCalled();
    await expect(readHtml("https://details.example/tv/42/fixture")).rejects.toThrow("temporarily unavailable");
    expect(mocked).toHaveBeenCalledTimes(1);
    expect(sourceUrl("https://details.example.evil.example/", "https://details.example")).toBeUndefined();
  });

  it("rejects JSON responses and 200-status challenge pages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response('{}', { headers: { "Content-Type": "application/json" } })).mockResolvedValueOnce(htmlResponse('<title>Just a moment...</title>')));
    await expect(readHtml("https://details.example/tv/42/fixture")).rejects.toThrow("temporarily unavailable");
    await expect(readHtml("https://metadata.example/")).rejects.toThrow("temporarily unavailable");
  });

  it("accepts published HTML containing a challenge script, but rejects an interstitial form", async () => {
    const content = '<title>Drama News</title><main>Published catalog</main><script src="/cdn-cgi/challenge-platform/script.js"></script>';
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(htmlResponse(content)).mockResolvedValueOnce(htmlResponse('<form id="challenge-form">Please wait</form>')));
    expect(await readHtml("https://metadata.example/")).toBe(content);
    await expect(readHtml("https://metadata.example/")).rejects.toThrow("temporarily unavailable");
  });
});
