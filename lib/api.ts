import "server-only";
import { cache } from "react";
import { catalogRoute, normalizeTitle, parseCatalogRoute, type CatalogTitle } from "./catalog";
import { enrichArtwork, findMetadata, getHomepage, getMetadataList, searchMetadata } from "./metadata";
import { findDramaDetails, getDramaDetails, getDetailEpisodes, type DetailRecord } from "./details";
import { getPlaybackCatalog, getPlaybackEpisodes, getPlaybackStream } from "./playback";
import { getSourceConfig } from "./server-config.mjs";
import type { DramaResponse, EpisodeResponse, HotSeriesResponse, PopularResponse, RecentMoviesResponse, RecentResponse, ScheduleDrama, ScheduleResponse, SearchResponse, TopDramasResponse } from "./api-types";

export type * from "./api-types";
export { formatRelativeTime } from "./format";
export { fetchSearchClient } from "./api-client";

function pageSlice<T>(items: T[], page: number, size = 20): T[] {
  const current = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  return items.slice((current - 1) * size, current * size);
}
const popularRow = (item: CatalogTitle) => ({ "detail-link": catalogRoute(item), image: item.image, title: item.title });

export async function fetchRecent(page = 1): Promise<RecentResponse> {
  const items = (await getPlaybackCatalog()).filter(item => !item.movie && item.episode);
  return { results: (await enrichArtwork(pageSlice(items, page))).map(item => ({
    "episode-link": `${catalogRoute(item)}/episode/s1e${item.episode}`, episode_number: item.episode,
    image: item.image, time: "Available now", title: item.title, type: "Drama",
  })) };
}

export async function fetchPopular(page = 1): Promise<PopularResponse> {
  return { results: (await getMetadataList("popular", page)).map(popularRow) };
}

export async function fetchRecentMovies(page = 1): Promise<RecentMoviesResponse> {
  const items = (await getPlaybackCatalog()).filter(item => item.movie);
  const movies = (await enrichArtwork(pageSlice(items, page))).map(item => ({ ep: "1", id: `${catalogRoute(item)}/episode/1`, img: item.image, time: "Available now", title: item.title, type: "Movie" }));
  return { result: { movies, page, pagination: { current: page, last: Math.ceil(items.length / 20), pages: [] } } };
}

export async function fetchSearch(query: string, page = 1): Promise<SearchResponse> {
  const text = query.trim().replace(/-/g, " ");
  if (!text) return { results: [] };
  const [metadata, playback] = await Promise.allSettled([searchMetadata(text, page), getPlaybackCatalog()]);
  const rows = new Map<string, ReturnType<typeof popularRow>>();
  if (metadata.status === "fulfilled") metadata.value.forEach(item => rows.set(catalogRoute(item), popularRow(item)));
  if (playback.status === "fulfilled") {
    const unique = new Map(playback.value.filter(item => normalizeTitle(item.title).includes(normalizeTitle(text))).map(item => [catalogRoute(item), item]));
    pageSlice([...unique.values()], page).forEach(item => { if (!rows.has(catalogRoute(item))) rows.set(catalogRoute(item), popularRow(item)); });
  }
  if (!rows.size && metadata.status === "rejected") throw metadata.reason;
  return { results: [...rows.values()] };
}

export const fetchDrama = cache(async (slug: string): Promise<DramaResponse> => {
  const identity = parseCatalogRoute(slug);
  let item: DetailRecord | null = null;
  let detailsUnavailable = false;
  let fromMetadata = false;
  const legacy = /^(movie-)?(\d+)$/.exec(slug);
  if (!identity && !legacy) throw new Error("Invalid drama identifier");
  if (legacy) {
    item = await getDramaDetails(`${getSourceConfig().detailsOrigin}/${legacy[1] ? "movies" : "tv"}/${legacy[2]}/`);
  } else if (identity) {
    const alternative = await findMetadata(identity.title, identity.year, identity.movie);
    if (alternative) {
      item = { ...alternative, meta: alternative.meta || {} };
      fromMetadata = true;
    }
    try { if (!item) item = await findDramaDetails(identity.title, identity.year, identity.movie); }
    catch { detailsUnavailable = true; }
    if (!item) detailsUnavailable = true;
  }
  const movie = item?.movie ?? identity?.movie ?? false;
  const year = item?.year ?? identity?.year;
  let title = item?.title || identity!.title;
  let available: Awaited<ReturnType<typeof getPlaybackEpisodes>> = [];
  try {
    available = await getPlaybackEpisodes(title, year, movie);
    if (!available.length && identity && normalizeTitle(title) !== normalizeTitle(identity.title)) available = await getPlaybackEpisodes(identity.title, year, movie);
    if (!item && available.length) title = available[0].title;
  } catch { /* Details can still render if playback catalog is unavailable. */ }
  let episodes: NonNullable<NonNullable<DramaResponse["result"]>["episodes"]> = [];
  if (item && !movie && !fromMetadata) {
    try { episodes = (await getDetailEpisodes(item)).map(ep => ({ episode: ep.episode, episode_link: `/${slug}/episode/s${ep.season}e${ep.episode}`, title: ep.title, release_date: ep.date })); }
    catch { /* Verified available playback entries can supply navigation. */ }
  }
  const existing = new Set(episodes.map(ep => ep.episode_link));
  for (const entry of available) {
    if (!movie && !entry.episode) continue;
    const episode = entry.episode || 1;
    const episode_link = `/${slug}/episode/${movie ? "1" : `s1e${episode}`}`;
    if (!existing.has(episode_link)) { episodes.push({ episode, episode_link }); existing.add(episode_link); }
  }
  episodes.sort((a, b) => {
    const season = (value: string) => Number(value.match(/\/s(\d+)e/)?.[1] || 1);
    return season(a.episode_link) - season(b.episode_link) || a.episode - b.episode;
  });
  const [artwork] = await enrichArtwork([{ title, year, movie, url: item?.url || "", image: item?.image || "/file.svg" }]);
  return { result: { title, image: artwork.image, description: item?.overview, other_names: item?.otherNames,
    meta: item?.meta || (year ? { Released: year } : {}), episodes,
    detailsUnavailable,
  } };
});

export async function fetchEpisode(slug: string, episode: string): Promise<EpisodeResponse> {
  const match = /^(?:s(\d+)e)?(\d+(?:\.\d+)?)$/i.exec(episode);
  if (!match || Number(match[2]) < 1 || (match[1] && Number(match[1]) < 1)) throw new Error("Invalid episode identifier");
  const drama = await fetchDrama(slug);
  const title = drama.result?.title || slug;
  const movie = parseCatalogRoute(slug)?.movie || slug.startsWith("movie-");
  const year = Number(drama.result?.meta?.Released) || undefined;
  let stream: Awaited<ReturnType<typeof getPlaybackStream>> = null;
  if (!movie || (Number(match[2]) === 1 && Number(match[1] || 1) === 1)) {
    try { stream = await getPlaybackStream(title, match[2], movie, year, Number(match[1] || 1)); }
    catch { /* Show the episode's unavailable state without crashing navigation. */ }
  }
  return { result: { title: `${title} - Episode ${match[2]}`, category: { title }, video: stream?.url || "", servers: stream?.servers.map((server, index) => ({ name: `Server ${index + 1}`, url: server.url })),
    episodes: drama.result?.episodes?.map(ep => ({ id: ep.episode_link.split("/").pop(), title: ep.title, time: ep.release_date })),
  } };
}

export async function fetchHotSeries(): Promise<HotSeriesResponse> {
  const items = (await fetchRecent()).results;
  const unique = new Map(items.map(item => [item["episode-link"].split("/episode/")[0], item]));
  return { error: null, page: "hot-series", status: 200, result: { updates: [...unique].slice(0, 8).map(([route, item]) => ({
    content_type: "drama", drama_detail_link: route, drama_slug: route.slice(1), episode_detail_link: item["episode-link"], episode_number: item.episode_number || 1,
    full_title: item.title, id: [route.slice(1)], image: item.image, series_title: item.title, subtitle_type: `Episode ${item.episode_number}`,
  })) } };
}

export async function fetchPopularSeries(): Promise<TopDramasResponse> {
  const kinds = ["airing", "upcoming", "popular"] as const;
  const results = await Promise.allSettled(kinds.map(kind => getMetadataList(kind)));
  const lists: TopDramasResponse["result"]["lists"] = { airing: [], upcoming: [], popular: [] };
  const errors: TopDramasResponse["result"]["errors"] = {};
  results.forEach((result, index) => {
    const kind = kinds[index];
    if (result.status === "rejected") { errors[kind] = "Drama listings are temporarily unavailable."; return; }
    lists[kind] = result.value.slice(0, 10).map((item, rank) => ({ detail_link: catalogRoute(item), image: item.image, rank: rank + 1, release_year: item.year || 0, slug: catalogRoute(item).slice(1), title: item.title }));
  });
  return { error: null, page: "top-dramas", status: 200, result: { lists, errors } };
}

export async function fetchSchedule(): Promise<ScheduleResponse> {
  const data = await getHomepage();
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const days: ScheduleResponse["result"]["days"] = Object.fromEntries(names.map(day => [day.toLowerCase(), { count: 0, day, dramas: [] }]));
  for (const [kind, items] of [["Premiere", data.starting], ["Finale", data.ending]] as const) {
    for (const item of items) {
      // Only use actual source dates. Do not infer a release from list position.
      if (!item.date) continue;
      const timestamp = Date.parse(item.date);
      if (!Number.isFinite(timestamp)) continue;
      const day = new Date(timestamp).toLocaleDateString("en", { weekday: "long", timeZone: "Europe/Copenhagen" }).toLowerCase();
      const row: ScheduleDrama = { countdown: new Date(timestamp).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "Europe/Copenhagen" }), countdown_seconds: Math.floor((timestamp - Date.now()) / 1000), detail_link: catalogRoute(item), episode_count: 0, image: item.image, release_status: kind.toLowerCase(), release_timestamp: timestamp, slug: `${catalogRoute(item).slice(1)}-${kind}`, subtitle_type: kind, title: item.title };
      days[day].dramas.push(row); days[day].count++;
    }
  }
  return { error: null, page: "schedule", result: { days, schedule_note: "Premieres and finales this week. Dates shown in Copenhagen time." }, status: 200 };
}

export const fetchRecentCached = fetchRecent;
export const fetchPopularCached = fetchPopular;
export const fetchHotSeriesCached = fetchHotSeries;
export const fetchDramaCached = fetchDrama;
export const fetchEpisodeCached = fetchEpisode;
export const fetchSearchCached = fetchSearch;
export function clearCache() { /* Next.js manages HTML page revalidation. */ }
export function clearCacheByPattern(_pattern: string) { /* Next.js manages HTML page revalidation. */ }
export async function preloadHomeData() { await Promise.allSettled([fetchRecent(), fetchPopular()]); }
export async function batchRequests<T>(requests: (() => Promise<T>)[], batchSize = 3): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < requests.length; i += Math.max(1, batchSize)) results.push(...await Promise.all(requests.slice(i, i + Math.max(1, batchSize)).map(request => request())));
  return results;
}
