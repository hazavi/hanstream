// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { parseEditorialHomepage, parseMetadataDetail, parseMetadataIndex, publishedDate } from "../lib/metadata-parser.mjs";
import { collectMetadata, homepageSections, lookupMetadata, matchMetadata, rankingLists } from "../lib/metadata-source.mjs";

const detailHtml = `<title>Between Steps - DramaWiki</title><script>mw.config.set({"wgPageName":"Between_Steps"})</script><div class="mw-parser-output"><img class="thumbimage" src="/images/between.jpg"><h2><span id="Details">Details</span></h2><ul><li><b>Title:</b> Yeonae Baksa</li><li><b>Also known as:</b> Love Doctor</li><li><b>Genre:</b> Romance, youth</li><li><b>Episodes:</b> 12</li><li><b>Broadcast network:</b> ENA</li><li><b>Broadcast period:</b> 2026-Oct-05 to 2026-Nov-10</li></ul><h2>Synopsis</h2></div><div id="catlinks">KDrama KDrama2026</div>`;
const item = { title: "Between Steps", image: "/poster.jpg", url: "https://dramaeditorial.com/shows/between-steps/", sourceName: "Editorial" };
const card = `<div class="show-slide-item"><div class="show-slide-item-left"><img src="https://dramaeditorial.com/poster.jpg"></div><div class="show-title-name"><a href="/shows/between-steps/">Between Steps</a></div><span class="review-rating">0.0</span></div>`;
const editorialHtml = `<div id="trending">${card}</div><div id="most_reviewed">${card}</div><div class="des"><h3 class="post-title-thumbnail"><a href="/2026/10/between-steps-episodes-3-4/">Between Steps: Episodes 3-4</a></h3><span class="post-author"><a>Reviewer</a></span><time class="published" datetime="2026-10-14T21:00:24-07:00"></time></div>`;
const metadataDetail = () => parseMetadataDetail(detailHtml, "https://metadata.example/Between_Steps")!;
const snapshot = () => ({ version: 2, fetchedAt: "2026-10-17T12:00:00Z", sources: [], titles: [metadataDetail()], airingUrls: [metadataDetail().url], editorial: { titles: [item], trending: [item], popular: [item], reviews: [{ ...item, date: "2026-10-14T21:00:24-07:00" }] } });

describe("alternative HTML metadata", () => {
  it("parses published metadata fields, aliases, country, and published dates", () => {
    expect(metadataDetail()).toMatchObject({ year: 2026, startDate: "2026-10-05", endDate: "2026-11-10", meta: { Episodes: "12", Country: "South Korea" } });
    expect(matchMetadata([metadataDetail()], "Love Doctor", 2026)?.title).toBe("Between Steps");
    expect(matchMetadata([metadataDetail()], "Love Doctor", 2025)).toBeUndefined();
    expect(parseMetadataDetail(detailHtml.replace(" to 2026-Nov-10", ""), metadataDetail().url)?.endDate).toBeUndefined();
  });

  it("rejects incomplete and invalid dates and non-drama pages", () => {
    for (const value of ["2026", "2026-Oct", "TBA", "2026-Feb-31"]) expect(publishedDate(value)).toBeUndefined();
    expect(parseMetadataDetail("<title>Actor - DramaWiki</title>", "https://metadata.example/Actor")).toBeNull();
    expect(parseMetadataDetail(detailHtml.replace('src="/images/between.jpg"', ''), metadataDetail().url)?.image).toBe('/file.svg');
  });

  it("uses exact HTML search redirects and refuses a different remake year", async () => {
    const read = vi.fn().mockResolvedValue(detailHtml);
    expect((await lookupMetadata("Between Steps", 2026, false, read))?.url).toBe(metadataDetail().url);
    expect(await lookupMetadata("Between Steps", 2025, false, read)).toBeNull();
    expect(await lookupMetadata("Unknown Title", 2026, false, read)).toBeNull();
    expect(read.mock.calls.every(([address]) => !address.includes("api.php"))).toBe(true);
  });

  it("excludes missing pages and multi-season fragments from schedules", () => {
    const html = `<div class="mw-parser-output"><h2>Autumn 2026</h2><table><tr><th>Title</th><th>Air time</th></tr><tr><td><a href="/Between_Steps">Between Steps</a></td><td>(from Oct-12)</td></tr><tr><td><a class="new" href="/index.php?action=edit">Missing</a></td></tr><tr><td><a href="/Show#Season_6">Season 6</a></td></tr></table></div>`;
    expect(parseMetadataIndex(html)).toEqual([{ title: "Between Steps", url: metadataDetail().url, startDate: "2026-10-12" }]);
  });

  it("extracts posters, dated reviews, and native popular order without inventing scores", () => {
    const result = parseEditorialHomepage(editorialHtml);
    expect(result.popular[0].title).toBe("Between Steps");
    expect(result.reviews[0]).toMatchObject({ reviewer: "Reviewer", note: "Episode recap", reviewUrl: "https://dramaeditorial.com/2026/10/between-steps-episodes-3-4/" });
    expect(result.reviews[0].rating).toBeUndefined();
  });

  it("rolls weekly lists forward and uses Copenhagen dates for weekly coverage", () => {
    const data = snapshot();
    data.titles[0].startDate = "2026-10-12";
    data.titles[0].endDate = "2026-10-18";
    data.editorial.reviews[0].date = "2026-10-11T22:30:00Z"; // Monday in Copenhagen.
    const home = homepageSections(data, new Date("2026-10-17T12:00:00Z"));
    expect([home.starting.length, home.ending.length, home.trending.length]).toEqual([1, 1, 1]);
    const next = homepageSections(data, new Date("2026-10-19T12:00:00Z"));
    expect([next.starting.length, next.ending.length, next.trending.length]).toEqual([0, 0, 0]);
    expect(rankingLists(data, new Date("2026-10-19T12:00:00Z")).airing).toEqual([]);
  });

  it("preserves verified metadata when every refresh request fails", async () => {
    const data = snapshot();
    const refreshed = await collectMetadata(async () => { throw new Error("403"); }, { previous: data, limit: 1 });
    expect(refreshed.titles).toEqual(data.titles);
    expect(refreshed.editorial).toEqual(data.editorial);
    expect(refreshed.airingUrls).toEqual(data.airingUrls);
    expect(refreshed.fetchedAt).toBe(data.fetchedAt);
  });

  it("refreshes published schedule dates using only index HTML during a web request", async () => {
    const data = snapshot();
    const index = `<div class="mw-parser-output"><table><tr><th>Title</th><th>Air date</th></tr><tr><td><a href="/Upcoming_Show">Upcoming Show</a></td><td>2026-Oct-20</td></tr></table></div>`;
    const read = vi.fn(async address => address.includes('dramaeditorial.com') ? editorialHtml : index);
    const refreshed = await collectMetadata(read, { previous: data, limit: 0 });
    expect(read).toHaveBeenCalledTimes(5);
    expect(refreshed.titles.find((item: { title: string }) => item.title === 'Upcoming Show')).toMatchObject({ year: 2026, startDate: '2026-10-20', image: '/file.svg', indexOnly: true });
  });
});
