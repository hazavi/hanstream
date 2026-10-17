import "server-only";
/** Read public drama detail pages without API credentials or API endpoints. */
import { load } from "cheerio";
import { cache } from "react";
import { cleanText, httpsUrl, readHtml, sourceUrl, structuredItems, SourceUnavailable } from "./html";
import { normalizeTitle, type CatalogTitle } from "./catalog";
import { getSourceConfig } from "./server-config.mjs";

const BASE = getSourceConfig().detailsOrigin;
export type DetailRecord = CatalogTitle & { overview?: string; otherNames?: string; meta: Record<string, string | number>; episodesUrl?: string; country?: string };
export type DetailEpisode = { title?: string; season: number; episode: number; date?: string };

export function isAsianCountry(country: string): boolean {
  return /(?:\b(?:KR|KP|CN|TW|HK|JP|TH|PH|SG|MY|ID|VN|IN|PK|BD|NP|LK|KH|LA|MM|MN|BT)\b|korea|china|chinese|taiwan|hong kong|japan|thailand|philippines|singapore|malaysia|indonesia|vietnam|india|pakistan|bangladesh|nepal|sri lanka|cambodia|laos|myanmar|mongolia|bhutan)/i.test(country);
}

export function parseDetailPage(html: string, pageUrl: string): DetailRecord {
  const $ = load(html);
  const schema = structuredItems(html).find(item => ["TVSeries", "Movie"].includes(String(item["@type"]))) || {};
  const title = cleanText($("h1").first().text()) || String(schema.name || "");
  if (!title) throw new SourceUnavailable("Details");
  const meta: DetailRecord["meta"] = {};
  $(".SimklTVAboutTabsDetails tr, .SimklMovieAboutTabsDetails tr").each((_, el) => {
    const cells = $(el).children("td");
    if (cells.length !== 2) return;
    const key = cleanText(cells.eq(0).text()).replace(/:$/, "");
    if (["Country", "Language", "Air Date", "Original Title"].includes(key)) meta[key] = cleanText(cells.eq(1).text());
  });
  const country = String(meta.Country || (typeof schema.countryOfOrigin === "string" ? schema.countryOfOrigin : ""));
  if (country && !isAsianCountry(country)) throw new Error("This title is outside the Asian drama catalog.");
  const released = $("meta[property='og:release_date']").attr("content") || $("[itemprop='startDate']").first().text() || String(schema.datePublished || "");
  const year = Number(released.slice(0, 4)) || undefined;
  const genres = $("[itemprop='genre']").map((_, el) => cleanText($(el).text())).get();
  if (year) meta.Released = year;
  if (genres.length) meta.Genre = genres.join(", ");
  const episodeLink = $("a[href$='/episodes/']").filter((_, el) => /\d+ episodes/i.test($(el).text())).first();
  const count = Number(episodeLink.text().match(/\d+/)?.[0]);
  if (count) meta.Episodes = count;
  const rating = Number($("[itemprop='aggregateRating'] [itemprop='ratingValue']").first().text());
  if (rating) meta["Rating"] = rating;
  const movie = new URL(pageUrl).pathname.startsWith("/movies/");
  const canonical = sourceUrl($("meta[property='og:url']").attr("content") || $("link[rel='canonical']").attr("href"), BASE) || pageUrl;
  return { title, year, movie, url: canonical,
    image: httpsUrl($("#detailPosterImg, img[itemprop='image']").first().attr("src"), BASE) || "/file.svg",
    overview: cleanText($(".SimklTVAboutDetailsText[itemprop='description']").text()) || $("meta[property='og:description']").attr("content") || String(schema.description || ""),
    otherNames: cleanText($("h2[itemprop='alternateName']").text()) || String(meta["Original Title"] || ""),
    country, meta, episodesUrl: sourceUrl(episodeLink.attr("href") || $("a[href$='/episodes/']").first().attr("href"), BASE),
  };
}

export function parseDetailEpisodes(html: string, pageUrl: string): DetailEpisode[] {
  const $ = load(html);
  const episodes = new Map<string, DetailEpisode>();
  $("#tvShowInfoBlock a[href], .SimklTVEpisodes a[href]").each((_, el) => {
    const url = sourceUrl($(el).attr("href"), pageUrl);
    if (!url) return;
    const path = new URL(url).pathname;
    const match = /\/season-(\d+)\/episode-(\d+)\/?$/.exec(path);
    if (!match || !path.startsWith(new URL(pageUrl).pathname.replace(/episodes\/?$/, ""))) return;
    const row = $(el).parent();
    const date = row.attr("data-date") || row.parent().attr("data-date");
    if (date && Date.parse(date) > Date.now()) return;
    const season = Number(match[1]), episode = Number(match[2]);
    if (!season) return;
    episodes.set(`s${season}e${episode}`, { season, episode, title: cleanText(row.find(".SimklTVEpisodesEpTitle").text()) || undefined, date });
  });
  return [...episodes.values()].sort((a, b) => a.season - b.season || a.episode - b.episode);
}

export function parseDetailSearch(html: string): CatalogTitle[] {
  const $ = load(html);
  const items = new Map<string, CatalogTitle>();
  $("#SearchWrapper a[href], .rightPostersContainer a[href]").each((_, el) => {
    const url = sourceUrl($(el).attr("href"), BASE);
    if (!url || !/^\/(tv|movies)\/\d+\/[^/]+\/?$/.test(new URL(url).pathname)) return;
    const row = $(el).closest("li, .SearchResult, .search-result, .simklSearchResult, .rightPostersContainer");
    const title = cleanText($(el).attr("title") || $(el).find("img").attr("alt") || $(el).text());
    if (!title) return;
    const year = Number(row.text().match(/\b(?:19|20)\d{2}\b/)?.[0]) || undefined;
    items.set(url, { title, year, movie: new URL(url).pathname.startsWith("/movies/"), url, image: httpsUrl(row.find("img").first().attr("src"), BASE) || "/file.svg" });
  });
  return [...items.values()];
}

// The detail search may render in JavaScript. These public catalog pages include
// title links in HTML and let us resolve matching titles without its search API.
const getPublicCatalog = cache(async (movie: boolean): Promise<CatalogTitle[]> => {
  const pages = movie ? [`${BASE}/movies/`] : [`${BASE}/tv/drama/kr/all-years`, `${BASE}/tv/drama/`];
  const results = await Promise.allSettled(pages.map(async url => parseDetailSearch(await readHtml(url, 86400))));
  const items = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
  if (!items.length && results.every(result => result.status === "rejected")) throw new SourceUnavailable("Details");
  return [...new Map(items.map(item => [item.url, item])).values()];
});

export async function findDramaDetails(title: string, year?: number, movie = false): Promise<DetailRecord | null> {
  let candidates: CatalogTitle[] = [];
  try { candidates = parseDetailSearch(await readHtml(`${BASE}/search/?type=${movie ? "movies" : "tv"}&q=${encodeURIComponent(title)}`, 3600)); }
  catch { /* The server-rendered public catalog can still be accessible. */ }
  const matchesTitle = (item: CatalogTitle) => item.movie === movie && normalizeTitle(item.title) === normalizeTitle(title) && (!year || !item.year || item.year === year);
  let matches = candidates.filter(matchesTitle);
  if (!matches.length) matches = (await getPublicCatalog(movie)).filter(matchesTitle);
  for (const match of matches.slice(0, 3)) {
    const detail = await getDramaDetails(match.url);
    if ((!year || !detail.year || detail.year === year) && detail.country && isAsianCountry(detail.country)) return detail;
  }
  return null;
}

export async function getDramaDetails(url: string): Promise<DetailRecord> {
  if (!sourceUrl(url, BASE) || !/^\/(tv|movies)\/\d+(?:\/[^/]+)?\/?$/.test(new URL(url).pathname)) throw new Error("Invalid detail URL");
  return parseDetailPage(await readHtml(url, 86400), url);
}

export async function getDetailEpisodes(item: DetailRecord): Promise<DetailEpisode[]> {
  return item.episodesUrl ? parseDetailEpisodes(await readHtml(item.episodesUrl, 3600), item.episodesUrl) : [];
}
