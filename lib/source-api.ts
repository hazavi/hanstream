import "server-only";
import { cache } from "react";
import { catalogRoute, normalizeTitle, parseCatalogRoute, type CatalogTitle } from "./catalog";
import { enrichArtwork, findMetadata, searchMetadata } from "./metadata";
import { findDramaDetails, getDramaDetails, getDetailEpisodes, type DetailRecord } from "./details";
import { getPlaybackCatalog, getPlaybackEpisodes, getPlaybackStream } from "./playback";
import { getSourceConfig } from "./server-config.mjs";
import { searchAsianCatalogResults } from "./catalog-details";
import { findPublishedDetail } from './cover-reader';
import { findSupplementalDetails } from './supplemental-details';
import { isPublishedImage } from './image-utils.mjs';
import { validDramaSlug, validEpisodeId, validSearchQuery } from './request-validation';
import { createKeyedStaleCache } from './runtime-cache';
import { detailNeedsRefresh, mergeDramaResponse } from './detail-cache';
import { persistentLoader } from './persistent-cache';
import { englishText } from './display-language';
import {browseAsianDramas, type BrowseCategory} from './discovery-reader';
import {getAiringDramas} from './airing-reader';
import type { DramaResponse, EpisodeResponse, HotSeriesResponse, PopularResponse, RecentMoviesResponse, RecentResponse, SearchResponse, TopDramasResponse } from "./api-types";

export type * from "./api-types";
export { formatRelativeTime } from "./format";


function pageSlice<T>(items: T[], page: number, size = 20): T[] {
  const current = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  return items.slice((current - 1) * size, current * size);
}
const popularRow = (item: CatalogTitle) => ({ "detail-link": catalogRoute(item), image: item.image, title: item.title });

export async function fetchRecent(page = 1): Promise<RecentResponse> {
  const items = (await getPlaybackCatalog(page === 1)).filter(item => !item.movie && item.episode);
  return { results: (await enrichArtwork(pageSlice(items, page))).map(item => ({
    "episode-link": `${catalogRoute(item)}/episode/s${Number(/\bseason\s+(\d+)$/i.exec(item.title)?.[1]) || 1}e${item.episode}`, episode_number: item.episode,
    image: item.image, time: "Available now", title: item.title, type: "Drama",
  })) };
}

export async function fetchPopular(page = 1): Promise<PopularResponse> {
  return fetchCategory('popular-new', page);
}

export async function fetchCategory(category: BrowseCategory, page = 1): Promise<PopularResponse> {
  const listing = await browseAsianDramas(category, page);
  return {results: listing.items.map(popularRow), hasNext: listing.hasNext};
}

export async function fetchRecentMovies(page = 1): Promise<RecentMoviesResponse> {
  const items = (await getPlaybackCatalog()).filter(item => item.movie);
  const movies = (await enrichArtwork(pageSlice(items, page))).map(item => ({ ep: "1", id: `${catalogRoute(item)}/episode/1`, img: item.image, time: "Available now", title: item.title, type: "Movie" }));
  return { result: { movies, page, pagination: { current: page, last: Math.ceil(items.length / 20), pages: [] } } };
}

export async function fetchSearch(query: string, page = 1, preview = false): Promise<SearchResponse> {
  if (!validSearchQuery(query) || !Number.isInteger(page) || page < 1 || page > 2000) throw new Error('Enter a title up to 160 characters and a valid page number.');
  const text = query.trim().replace(/-/g, " ");
  if (!text) return { results: [] };
  let catalogFailed = false;
  try {
    const catalog = await searchAsianCatalogResults(text, page, preview ? 8 : 25);
    if (catalog.items.length || catalog.hasNext) return {results: catalog.items.map(popularRow), hasNext: catalog.hasNext};
  } catch { catalogFailed = true; }
  const [metadata, playback] = await Promise.allSettled([Promise.race([searchMetadata(text, page), new Promise<[]>(resolve => setTimeout(() => resolve([]), 1200))]), getPlaybackCatalog(true)]);
  const rows = new Map<string, ReturnType<typeof popularRow>>();
  if (metadata.status === "fulfilled") metadata.value.forEach(item => rows.set(catalogRoute(item), popularRow(item)));
  if (playback.status === "fulfilled") {
    const normalized = normalizeTitle(text);
    const unique = new Map(playback.value.filter(item => normalizeTitle(item.title).includes(normalized)).map(item => [catalogRoute(item), item]));
    pageSlice([...unique.values()], page).forEach(item => { if (!rows.has(catalogRoute(item))) rows.set(catalogRoute(item), popularRow(item)); });
  }
  if (!rows.size && metadata.status === "rejected" && catalogFailed && playback.status === 'rejected') throw metadata.reason;
  return { results: [...rows.values()], hasNext: false };
}

async function loadDrama(slug: string): Promise<DramaResponse> {
  if (!validDramaSlug(slug)) throw new Error('Invalid drama identifier');
  const identity = parseCatalogRoute(slug);
  let item: DetailRecord | null = null;
  let alternative: Awaited<ReturnType<typeof findMetadata>> = null;
  let detailsUnavailable = false;
  let primary: DetailRecord | null = null;
  let supplemental: DetailRecord | null = null;
  const legacy = /^(movie-)?(\d+)$/.exec(slug);
  if (!identity && !legacy) throw new Error("Invalid drama identifier");
  if (legacy) {
    item = await getDramaDetails(`${getSourceConfig().detailsOrigin}/${legacy[1] ? "movies" : "tv"}/${legacy[2]}/`);
    primary = item;
  } else if (identity) {
    const resolved: { primary: DetailRecord | null; alternative: Awaited<ReturnType<typeof findMetadata>>; supplemental: DetailRecord | null } = { primary: null, alternative: null, supplemental: null };
    const tasks = [
      findDramaDetails(identity.title, identity.year, identity.movie).then(value => { resolved.primary = value; }).catch(() => {}),
      findMetadata(identity.title, identity.year, identity.movie).then(value => { resolved.alternative = value; }).catch(() => {}),
    ];
    const extra = identity.movie ? Promise.resolve(null) : getPlaybackEpisodes(identity.title, identity.year).catch(() => []).then(entries => findSupplementalDetails(entries[0]?.title || identity.title, identity.year));
    const enriched = extra.then(value => { resolved.supplemental = value; });
    // A complete independent profile need not wait for an unreachable host.
    await Promise.race([Promise.all([...tasks, enriched]), extra.then(async value => { if (!value?.overview || !isPublishedImage(value.image) || !value.episodes?.length) await Promise.all(tasks); })]);
    primary = resolved.primary;
    alternative = resolved.alternative;
    supplemental = resolved.supplemental;
    if (supplemental) {
      const known = primary as DetailRecord | null;
      const extra = supplemental as DetailRecord;
      primary = known ? { ...extra, ...known, title: englishText(known.title, extra.title) || identity.title, image: isPublishedImage(known.image) ? known.image : extra.image, overview: englishText(known.overview, extra.overview), cast: known.cast?.length ? known.cast : extra.cast, episodes: known.episodes?.length ? known.episodes.map(ep => {
        const translated = extra.episodes?.find(other => other.season === ep.season && other.episode === ep.episode);
        return {...ep, title: englishText(ep.title, translated?.title), overview: englishText(ep.overview, translated?.overview)};
      }) : extra.episodes, meta: { ...extra.meta, ...known.meta } } : extra;
    }
    item = primary ? { ...primary, meta: { ...alternative?.meta, ...primary.meta }, overview: primary.overview || alternative?.overview } : alternative ? { ...alternative, meta: alternative.meta || {} } : null;
    detailsUnavailable = !item?.overview;
  }
  const movie = item?.movie ?? identity?.movie ?? false;
  const year = item?.year ?? identity?.year;
  let published: Awaited<ReturnType<typeof findPublishedDetail>> = null;
  let castPending = false;
  let castRefreshNeeded = false;
  if (!movie && !primary?.cast?.length && !alternative?.cast?.length && identity) {
    try {
      castPending = true;
      const lookup = findPublishedDetail(JSON.stringify({title:primary?.title || identity.title,year})).finally(()=>{castPending=false;});
      if (item?.overview) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        published = await Promise.race([lookup, new Promise<null>(resolve => { timer=setTimeout(()=>resolve(null),1200); })]).finally(()=>clearTimeout(timer));
        castRefreshNeeded = castPending;
      } else published = await lookup;
    }
    catch { /* Existing details still render if another catalog is unavailable. */ }
    if(published) item = item ? {...item,meta:{...published.meta,...item.meta},overview:item.overview || published.overview} : published;
  }
  let title = englishText(item?.title, identity?.title) || 'Drama';
  let available: Awaited<ReturnType<typeof getPlaybackEpisodes>> = [];
  try {
    available = await getPlaybackEpisodes(title, year, movie);
    if (!available.length && identity && normalizeTitle(title) !== normalizeTitle(identity.title)) available = await getPlaybackEpisodes(identity.title, year, movie);
    if (!item && available.length) title = englishText(available[0].title, title) || title;
  } catch { /* Details can still render if playback catalog is unavailable. */ }
  let episodes: NonNullable<NonNullable<DramaResponse["result"]>["episodes"]> = [];
  if (primary && !movie) {
    try { episodes = (await getDetailEpisodes(primary)).map(ep => ({ season: ep.season, episode: ep.episode, episode_link: `/${slug}/episode/s${ep.season}e${ep.episode}`, title: ep.title, release_date: ep.date, image: ep.image, description: ep.overview, finale: ep.finale, available: ep.upcoming || ep.date && ep.date > new Date().toISOString().slice(0, 10) ? false : undefined })); }
    catch { /* Verified available playback entries can supply navigation. */ }
  }
  if (!episodes.length && !movie && item) {
    const count = String(item?.meta.Episodes || '').trim();
    const finished = alternative?.endDate && alternative.endDate < new Date().toISOString().slice(0, 10) || /^(?:ended|finished|completed)$/i.test(String(item?.meta.Status || ''));
    if (finished && /^\d+$/.test(count) && Number(count) <= 2000) {
      episodes = Array.from({ length: Number(count) }, (_, index) => ({ season: 1, episode: index + 1, episode_link: `/${slug}/episode/s1e${index + 1}` }));
    }
  }
  const embeddedSeason = Number(/\bseason\s+(\d+)$/i.exec(title)?.[1]) || 1;
  const availableSeasons = new Map([[embeddedSeason, available]]);
  const laterSeasons = [...new Set(episodes.map(ep => ep.season || 1))].filter(season => season !== embeddedSeason);
  await Promise.all(laterSeasons.map(async season => {
    try { availableSeasons.set(season, await getPlaybackEpisodes(`${title} Season ${season}`, year, movie)); }
    catch { /* Preserve published season details if a playback index is unavailable. */ }
  }));
  const existing = new Set(episodes.map(ep => ep.episode_link));
  for (const [season, entries] of availableSeasons) for (const entry of entries) {
    if (!movie && !entry.episode) continue;
    const episode = entry.episode || 1;
    const episode_link = `/${slug}/episode/${movie ? "1" : `s${season}e${episode}`}`;
    const published = episodes.find(ep => ep.episode_link === episode_link);
    if (published) published.available = true;
    else if (!existing.has(episode_link)) { episodes.push({ season, episode, episode_link, available: true }); existing.add(episode_link); }
  }
  episodes.sort((a, b) => {
    const season = (value: string) => Number(value.match(/\/s(\d+)e/)?.[1] || 1);
    return season(a.episode_link) - season(b.episode_link) || a.episode - b.episode;
  });
  const [artwork] = await enrichArtwork([{ title, year, movie, url: item?.url || "", image: item?.image || "/file.svg" }]);
  const posters = [...new Set([alternative?.image].filter((image): image is string => Boolean(image && image !== "/file.svg" && image !== artwork.image)))];
  const genres = primary?.genres?.length ? primary.genres : String(item?.meta.Genre || '').split(/[,;]/).map(value => value.trim()).filter(Boolean);
  const castSources=[primary?.cast || [],alternative?.cast || [],supplemental?.cast || [],published?.cast || []].sort((a,b)=>b.length-a.length);
  const cast=castSources[0].map(person=>{
    const key=normalizeTitle(person.name).replaceAll(' ','');
    const extra=castSources.flat().find(other=>normalizeTitle(other.name).replaceAll(' ','')===key && other.image);
    return {...person,image:person.image || extra?.image};
  });
  return { result: { title, image: artwork.image, description: englishText(item?.overview, supplemental?.overview, alternative?.overview, published?.overview), other_names: item?.otherNames,
    meta: item?.meta || (year ? { Released: year } : {}), episodes,
    tags: primary?.tags?.length ? primary.tags : genres, genres, cast, trailer: primary?.trailer, poster_fallbacks: posters, detailsUnavailable, refreshPending:Boolean(primary?.refreshPending || castRefreshNeeded),
  } };
}
const loadPersistentDrama = persistentLoader('detail-asian-v3', async (slug, previous?: DramaResponse) => mergeDramaResponse(previous, await loadDrama(slug)), value => Boolean(value?.result?.title && !detailNeedsRefresh(value)));
const cachedDrama = createKeyedStaleCache(loadPersistentDrama, value => detailNeedsRefresh(value) ? 15_000 : 300_000, 100, value => !detailNeedsRefresh(value));
export const peekDrama = (slug:string) => cachedDrama.peek(slug);
export const fetchDrama = cache(async (slug: string) => {
  if (!validDramaSlug(slug)) throw new Error('Invalid drama identifier');
  return cachedDrama(slug);
});

export async function fetchEpisode(slug: string, episode: string): Promise<EpisodeResponse> {
  if (!validEpisodeId(episode)) throw new Error('Invalid episode identifier');
  const match = /^(?:s(\d+)e)?(\d+(?:\.\d+)?)$/i.exec(episode);
  if (!match || Number(match[2]) < 1 || (match[1] && Number(match[1]) < 1)) throw new Error("Invalid episode identifier");
  if (!validDramaSlug(slug)) throw new Error('Invalid drama identifier');
  const identity = parseCatalogRoute(slug);
  const drama = cachedDrama.peek(slug) || (identity ? undefined : await fetchDrama(slug));
  const title = drama?.result?.title || identity?.title || slug;
  const movie = identity?.movie || slug.startsWith("movie-");
  const year = identity?.year || Number(drama?.result?.meta?.Released) || undefined;
  const embeddedSeason = Number(/\bseason\s+(\d+)$/i.exec(title)?.[1]);
  const season = Number(match[1] || 1) === 1 && embeddedSeason ? embeddedSeason : Number(match[1] || 1);
  let stream: Awaited<ReturnType<typeof getPlaybackStream>> = null;
  if (!movie || (Number(match[2]) === 1 && Number(match[1] || 1) === 1)) {
    try { stream = await getPlaybackStream(title, match[2], movie, year, season); }
    catch { /* Show the episode's unavailable state without crashing navigation. */ }
  }
  return { result: { title: `${title} - Episode ${match[2]}`, current_episode: movie ? '1' : `s${season}e${match[2]}`, category: { title }, video: stream?.url || "", servers: stream?.servers.map((server, index) => ({ name: `Server ${index + 1}`, url: server.url })),
    episodes: drama?.result?.episodes?.map(ep => ({ id: ep.episode_link.split("/").pop(), title: ep.title, time: ep.release_date, season: ep.season, episode: ep.episode, image: ep.image, description: ep.description, available: ep.available })),
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
  const results = await Promise.allSettled(kinds.map(kind => kind==='airing'?getAiringDramas():browseAsianDramas(kind==='upcoming'?'upcoming':'popular-new').then(value=>value.items)));
  const lists: TopDramasResponse["result"]["lists"] = { airing: [], upcoming: [], popular: [] };
  const errors: TopDramasResponse["result"]["errors"] = {};
  results.forEach((result, index) => {
    const kind = kinds[index];
    if (result.status === "rejected") { errors[kind] = "Drama listings are temporarily unavailable."; return; }
    lists[kind] = result.value.slice(0, 10).map((item, rank) => ({ detail_link: catalogRoute(item), image: item.image, rank: rank + 1, release_year: item.year || 0, slug: catalogRoute(item).slice(1), title: item.title }));
  });
  return { error: null, page: "top-dramas", status: 200, result: { lists, errors } };
}

export const fetchRecentCached = fetchRecent;
export const fetchPopularCached = fetchPopular;
export const fetchHotSeriesCached = fetchHotSeries;
export const fetchDramaCached = fetchDrama;
export const fetchEpisodeCached = fetchEpisode;
export const fetchSearchCached = fetchSearch;
export function clearCache() { cachedDrama.clear(); }
export function clearCacheByPattern(_pattern: string) { /* Next.js manages HTML page revalidation. */ }
export async function preloadHomeData() { await Promise.allSettled([fetchRecent(), fetchPopular()]); }
export async function batchRequests<T>(requests: (() => Promise<T>)[], batchSize = 3): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < requests.length; i += Math.max(1, batchSize)) results.push(...await Promise.all(requests.slice(i, i + Math.max(1, batchSize)).map(request => request())));
  return results;
}
