import "server-only";
/** Read public drama detail pages without API credentials or API endpoints. */
import { load } from "cheerio";
import { cache } from "react";
import { cleanText, httpsUrl, readHtml, sourceUrl, structuredItems, SourceUnavailable } from "./html";
import { normalizeTitle, type CatalogTitle } from "./catalog";
import { getSourceConfig } from "./server-config.mjs";
import type { DramaTrailer } from "./api-types";

const BASE = getSourceConfig().detailsOrigin;
export type DetailRecord = CatalogTitle & { overview?: string; otherNames?: string; meta: Record<string, string | number>; episodesUrl?: string; country?: string; tags?: string[]; genres?: string[]; trailer?: DramaTrailer };
export type DetailEpisode = { title?: string; season: number; episode: number; date?: string; image?: string; finale?: boolean };

function imageUrl(value: string | undefined, base: string): string | undefined {
  const address = httpsUrl(value, base);
  return address && !/(?:^|\/)(?:no[-_]?image|no[-_]?poster|placeholder|blank|default)[^/]*\.(?:gif|png|jpe?g|webp)(?:\?|$)/i.test(new URL(address).pathname) ? address : undefined;
}

export function parseTrailerUrl(value: string | undefined): DramaTrailer | undefined {
  if (!value) return;
  try {
    const url = new URL(value.startsWith("//") ? `https:${value}` : value);
    if (url.protocol !== "https:" || url.username || url.password) return;
    const host = url.hostname.replace(/^www\./, "");
    const id = host === "youtu.be" ? url.pathname.slice(1) : ["youtube.com", "youtube-nocookie.com"].includes(host) ? url.searchParams.get("v") || /^\/(?:embed|shorts)\/([^/]+)/.exec(url.pathname)?.[1] : host === "i.ytimg.com" ? /^\/(?:vi|vi_webp)\/([^/]+)/.exec(url.pathname)?.[1] : undefined;
    if (id && /^[\w-]{11}$/.test(id)) return { embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  } catch { /* Ignore unsupported or malformed media links. */ }
}

function names(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(names);
  if (value && typeof value === "object" && "name" in value) return names(value.name);
  return [];
}

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
    if (["Country", "Language", "Air Date", "Original Title", "Age Rating", "Network", "Status", "Runtime", "Duration"].includes(key)) meta[key] = cleanText(cells.eq(1).text());
  });
  const country = String(meta.Country || names(schema.countryOfOrigin).join(", "));
  if (country && !isAsianCountry(country)) throw new Error("This title is outside the Asian drama catalog.");
  const released = $("meta[property='og:release_date']").attr("content") || $("[itemprop='startDate']").first().text() || String(schema.datePublished || "");
  const year = Number(released.slice(0, 4)) || undefined;
  const genres = [...new Set([...$("[itemprop='genre']").map((_, el) => cleanText($(el).text())).get(), ...names(schema.genre)].filter(Boolean))];
  if (year) meta.Released = year;
  if (genres.length) meta.Genre = genres.join(", ");
  const episodeLink = $("a[href$='/episodes/']").filter((_, el) => /\d+ episodes/i.test($(el).text())).first();
  const count = Number(episodeLink.text().match(/\d+/)?.[0] || schema.numberOfEpisodes);
  if (count) meta.Episodes = count;
  const rating = Number($("[itemprop='aggregateRating'] [itemprop='ratingValue']").first().text());
  const aggregate = schema.aggregateRating && typeof schema.aggregateRating === "object" ? schema.aggregateRating as Record<string, unknown> : {};
  if (rating || Number(aggregate.ratingValue)) meta.Rating = rating || Number(aggregate.ratingValue);
  const votes = Number($("[itemprop='ratingCount']").first().attr("content") || $("[itemprop='ratingCount']").first().text().replace(/[^\d]/g, "") || aggregate.ratingCount);
  if (votes) meta["Rating votes"] = votes;
  if (country) meta.Country = country;
  if (!meta.Language && names(schema.inLanguage).length) meta.Language = names(schema.inLanguage).join(", ");
  if (!meta["Age Rating"] && typeof schema.contentRating === "string") meta["Age Rating"] = schema.contentRating;
  const network = cleanText($("a[itemprop='publication'], [itemprop='publisher'] [itemprop='name'], a[href*='/networks/']").first().text()) || names(schema.publisher).join(", ");
  if (network) meta.Network = network;
  const header = cleanText($("#tvShowInfoBlock").text());
  const seasons = Number(schema.numberOfSeasons || header.match(/\b(\d+)\s+seasons?\b/i)?.[1]);
  if (seasons) meta.Seasons = seasons;
  const duration = $("[itemprop='duration']").first().attr("content") || $("[itemprop='duration']").first().text() || (typeof schema.duration === "string" ? schema.duration : "");
  if (duration) meta.Duration = duration.replace(/^PT(?:(\d+)H)?(?:(\d+)M)?$/, (_, hours, minutes) => [hours && `${hours} hr`, minutes && `${minutes} min`].filter(Boolean).join(" "));
  if (!meta.Status && schema.endDate) meta.Status = "Ended";
  else if (!meta.Status && /\bNow\b/i.test(String(meta["Air Date"] || ""))) meta.Status = "Airing";
  const tags = new Set<string>();
  $(".SimklTVAboutTabsDetails tr, .SimklMovieAboutTabsDetails tr").each((_, el) => {
    const cells = $(el).children("td");
    if (cells.length === 2 && /^Tags:$/i.test(cleanText(cells.eq(0).text()))) cells.eq(1).find("a").each((_, tag) => { const label = cleanText($(tag).text()); if (label && label.length <= 80 && !/more$/i.test(label)) tags.add(label); });
  });
  if (typeof schema.keywords === "string") schema.keywords.split(",").map(cleanText).filter(Boolean).forEach(tag => tags.add(tag));
  let trailer: DramaTrailer | undefined;
  $("iframe[src], iframe[data-src], a[href], img[src], img[data-src], [data-youtube], [data-video]").each((_, el) => {
    if (trailer) return;
    const node = $(el);
    const candidate = parseTrailerUrl(node.attr("href") || node.attr("data-src") || node.attr("src") || node.attr("data-youtube") || node.attr("data-video"));
    if (candidate) trailer = { ...candidate, title: cleanText(node.attr("title") || node.attr("alt") || "") || "Official trailer" };
  });
  if (!trailer) {
    for (const video of structuredItems(html).filter(item => item["@type"] === "VideoObject")) {
      trailer = parseTrailerUrl(String(video.embedUrl || video.contentUrl || video.thumbnailUrl || ""));
      if (trailer) { trailer.title = typeof video.name === "string" ? video.name : "Official trailer"; break; }
    }
  }
  const movie = new URL(pageUrl).pathname.startsWith("/movies/");
  const canonical = sourceUrl($("meta[property='og:url']").attr("content") || $("link[rel='canonical']").attr("href"), BASE) || pageUrl;
  return { title, year, movie, url: canonical,
    image: imageUrl($("#detailPosterImg, img[itemprop='image']").first().attr("data-src") || $("#detailPosterImg, img[itemprop='image']").first().attr("src") || $("meta[property='og:image']").attr("content"), BASE) || "/file.svg",
    overview: typeof schema.description === "string" && schema.description ? cleanText(schema.description) : cleanText($(".SimklTVAboutDetailsText[itemprop='description'], [itemprop='description']").first().clone().find("script, style, button").remove().end().text()) || $("meta[property='og:description']").attr("content"),
    otherNames: cleanText($("h2[itemprop='alternateName']").text()) || String(meta["Original Title"] || ""),
    country, meta, tags: [...tags], genres, trailer, episodesUrl: sourceUrl(episodeLink.attr("href") || $("a[href$='/episodes/']").first().attr("href"), BASE),
  };
}

export function parseDetailEpisodes(html: string, pageUrl: string): DetailEpisode[] {
  const $ = load(html);
  const episodes = new Map<string, DetailEpisode>();
  $("a[href], [data-href*='/season-'], [data-url*='/season-'], [onclick*='/season-']").each((_, el) => {
    const node = $(el);
    const href = node.attr("href") || node.attr("data-href") || node.attr("data-url") || /["']((?:https:\/\/[^/]+)?\/(?:tv|movies)\/[^"']+\/season-\d+\/episode-\d+\/?)["']/.exec(node.attr("onclick") || "")?.[1];
    const url = sourceUrl(href, pageUrl);
    if (!url) return;
    const path = new URL(url).pathname;
    const match = /\/season-(\d+)\/episode-(\d+)\/?$/.exec(path);
    if (!match || !path.startsWith(new URL(pageUrl).pathname.replace(/episodes\/?$/, ""))) return;
    const anchor = $(el);
    const parent = anchor.parent();
    const row = parent.find("a[href*='/season-'], [data-href*='/season-'], [data-url*='/season-']").length > 2 ? anchor : parent;
    const date = anchor.attr("data-date") || row.attr("data-date") || row.parent().attr("data-date") || row.find("time").first().attr("datetime");
    const season = Number(match[1]), episode = Number(match[2]);
    if (!season) return;
    const image = row.find("img").first();
    const style = anchor.attr("style") || row.attr("style") || row.find("[style*='url(']").first().attr("style") || "";
    const picture = imageUrl(image.attr("data-src") || image.attr("data-original") || image.attr("src") || /url\(["']?([^"')]+)["']?\)/.exec(style)?.[1], pageUrl);
    const name = cleanText(row.find(".SimklTVEpisodesEpTitle, [itemprop='name']").first().text() || anchor.attr("title") || anchor.text().replace(/S\d+\s*E\d+/i, "").replace(/Series Finale|Season Finale/gi, ""));
    const key = `s${season}e${episode}`;
    const previous = episodes.get(key);
    episodes.set(key, { ...previous, season, episode, ...(name && !/^TBA$/i.test(name) ? { title: name } : {}), ...(date ? { date } : {}), ...(picture ? { image: picture } : {}), ...(/series finale|season finale/i.test(row.text()) ? { finale: true } : {}) });
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
