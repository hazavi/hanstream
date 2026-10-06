import { getSimklDrama, getSimklEpisodes, getSimklMovie, simklGet, simklHeaders, simklId, simklLink, simklPoster, type SimklItem } from "./simkl";
import { getKisskhStream } from "./kisskh";

export type RecentItem = { "episode-link": string; episode_number?: number; image: string; time: string; title: string; type: string };
export type RecentMovieItem = { ep: string; id: string; img: string; time: string; title: string; type: string };
export type PopularItem = { "detail-link": string; image: string; title: string };
export type SearchResultItem = PopularItem;
export type EpisodeListItem = { id?: string; title?: string; type?: string; time?: string };
export type EpisodeResult = { title: string; type?: string; video: string; category?: { title?: string }; episodes?: EpisodeListItem[]; sourcePage?: string };
export type DramaResponse = { result?: { title?: string; image?: string; description?: string; other_names?: string; meta?: Record<string, unknown>; episodes?: { episode: number; episode_link: string; type?: string; release_date?: string; title?: string }[]; simklUrl?: string } };
export type EpisodeResponse = { result: EpisodeResult };
export type RecentResponse = { results: RecentItem[] };
export type PopularResponse = { results: PopularItem[] };
export type SearchResponse = { results: SearchResultItem[] };
export type RecentMoviesResponse = { result: { movies: RecentMovieItem[]; page: number; pagination: { current: number; last: number; pages: number[] } } };
export type HotSeriesUpdateItem = { content_type: string; drama_detail_link: string; drama_slug: string; episode_detail_link: string; episode_number: number; full_title: string; id: string[]; image: string; series_title: string; subtitle_type: string };
export type HotSeriesResponse = { error: string | null; page: string; result: { source_url: string; updates: HotSeriesUpdateItem[] }; status: number };
export type TopDramaItem = { detail_link: string; external_link: string; image: string; rank: number; release_year: number; slug: string; title: string };
export type TopDramasResponse = { error: string | null; page: string; result: { periods: { day: TopDramaItem[]; week: TopDramaItem[]; month: TopDramaItem[] }; source_url: string }; status: number };
export type PopularSeriesItem = { detail_link: string; genres: string[]; id: string[]; image: string; range: "weekly" | "monthly" | "all"; rank: number; rating_percent: number; score: number; slug: string; title: string };

function route(item: SimklItem, movie = false) {
  const id = simklId(item);
  return id ? `/${movie ? `movie-${id}` : id}` : "";
}

function pageSlice<T>(items: T[], page: number, size = 20): T[] {
  return items.slice((Math.max(1, page) - 1) * size, Math.max(1, page) * size);
}

async function trending(type: "tv" | "movies", period: "today" | "week" | "month" = "today"): Promise<SimklItem[]> {
  const clientId = process.env.SIMKL_CLIENT_ID;
  if (!clientId) throw new Error("SIMKL_CLIENT_ID is required. Add it to .env.local.");
  const url = new URL(`https://data.simkl.in/discover/trending/${type}/${period}_100.json`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("app-name", "hanstream");
  url.searchParams.set("app-version", "0.1.0");
  const response = await fetch(url, { headers: simklHeaders(), next: { revalidate: period === "today" ? 3600 : 86400 }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Simkl trending returned ${response.status}`);
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchRecent(page = 1): Promise<RecentResponse> {
  const items = await trending("tv");
  return { results: pageSlice(items, page).filter((item) => simklId(item)).map((item) => ({
    "episode-link": route(item), image: simklPoster(item.poster), time: item.date || "Trending today", title: item.title, type: "TV",
  })) };
}

export async function fetchPopular(page = 1): Promise<PopularResponse> {
  const items = await trending("tv", "week");
  return { results: pageSlice(items, page).filter((item) => simklId(item)).map((item) => ({ "detail-link": route(item), image: simklPoster(item.poster), title: item.title })) };
}

export async function fetchRecentMovies(page = 1): Promise<RecentMoviesResponse> {
  const items = await trending("movies", "week");
  const movies = pageSlice(items, page).filter((item) => simklId(item)).map((item) => ({ ep: "1", id: route(item, true), img: simklPoster(item.poster), time: item.date || "Trending this week", title: item.title, type: "Movie" }));
  return { result: { movies, page, pagination: { current: page, last: Math.ceil(items.length / 20), pages: [] } } };
}

export async function fetchSearch(query: string, page = 1): Promise<SearchResponse> {
  const text = query.trim().replace(/-/g, " ");
  if (!text) return { results: [] };
  const shows = await simklGet<SimklItem[]>(`/search/tv?q=${encodeURIComponent(text)}&page=${page}&limit=20`, 300);
  const movies = await simklGet<SimklItem[]>(`/search/movie?q=${encodeURIComponent(text)}&page=${page}&limit=20`, 300);
  return { results: [
    ...shows.filter((item) => simklId(item)).map((item) => ({ "detail-link": route(item), image: simklPoster(item.poster), title: item.title })),
    ...movies.filter((item) => simklId(item)).map((item) => ({ "detail-link": route(item, true), image: simklPoster(item.poster), title: item.title })),
  ] };
}

export async function fetchDrama(slug: string): Promise<DramaResponse> {
  const movie = slug.startsWith("movie-");
  const id = movie ? slug.slice(6) : slug;
  const item = movie ? await getSimklMovie(id) : await getSimklDrama(id);
  const episodes = movie ? [{ episode: 1, episode_link: `/${slug}/episode/1`, title: item.title }] : (await getSimklEpisodes(id))
    .filter((ep) => ep.type !== "special" && ep.episode && ep.aired !== false)
    .map((ep) => ({ episode: ep.episode!, episode_link: `/${slug}/episode/s${ep.season || 1}e${ep.episode}`, release_date: ep.date || undefined, title: ep.title }));
  return { result: {
    title: item.title, image: simklPoster(item.poster), description: item.overview,
    meta: { ...(item.year ? { Released: item.year } : {}), ...(item.status ? { Status: item.status } : {}), ...(item.runtime ? { Duration: `${item.runtime} min` } : {}), ...(item.genres?.length ? { Genre: item.genres.join(", ") } : {}), ...(item.country ? { Country: item.country } : {}), ...(item.ratings?.simkl?.rating ? { "Simkl rating": item.ratings.simkl.rating } : {}) },
    episodes, simklUrl: simklLink(item, movie ? "movies" : "tv"),
  } };
}

export async function fetchEpisode(slug: string, episode: string): Promise<EpisodeResponse> {
  const drama = await fetchDrama(slug);
  const title = drama.result?.title || slug;
  const seasonMatch = /^s(\d+)e(\d+)$/i.exec(episode);
  const number = seasonMatch ? seasonMatch[2] : episode;
  const stream = await getKisskhStream(title, number, slug.startsWith("movie-"));
  return { result: {
    title: `${title} - Episode ${number}`, category: { title }, video: stream?.url || "", sourcePage: stream?.pageUrl,
    episodes: drama.result?.episodes?.map((ep) => ({ id: ep.episode_link.split("/").pop(), title: ep.title, time: ep.release_date })),
  } };
}

export async function fetchHotSeries(): Promise<HotSeriesResponse> {
  const items = (await trending("tv")).slice(0, 8);
  return { error: null, page: "hot-series", status: 200, result: { source_url: "https://simkl.com/tv/best-shows/most-watched", updates: items.filter((item) => simklId(item)).map((item) => ({ content_type: "tv", drama_detail_link: route(item), drama_slug: String(simklId(item)), episode_detail_link: route(item), episode_number: 1, full_title: item.title, id: [String(simklId(item))], image: simklPoster(item.poster), series_title: item.title, subtitle_type: "Simkl trending" })) } };
}

export async function fetchPopularSeries(): Promise<TopDramasResponse> {
  const [day, week, month] = await Promise.all([trending("tv", "today"), trending("tv", "week"), trending("tv", "month")]);
  const toRows = (items: SimklItem[]) => items.slice(0, 10).filter((item) => simklId(item)).map((item, index) => ({ detail_link: route(item), external_link: simklLink(item), image: simklPoster(item.poster), rank: index + 1, release_year: item.year || 0, slug: String(simklId(item)), title: item.title }));
  return { error: null, page: "top-dramas", status: 200, result: { source_url: "https://simkl.com/tv/best-shows/most-watched", periods: { day: toRows(day), week: toRows(week), month: toRows(month) } } };
}

export type ScheduleDrama = { countdown: string; countdown_seconds: number; detail_link: string; episode_count: number; external_link: string; image: string; release_status: string; release_timestamp: number | null; slug: string; subtitle_type: string | null; title: string };
export type ScheduleResponse = { error: null; page: string; result: { days: Record<string, { count: number; day: string; dramas: ScheduleDrama[] }>; schedule_note: string }; status: number };

export async function fetchSchedule(): Promise<ScheduleResponse> {
  const clientId = process.env.SIMKL_CLIENT_ID;
  if (!clientId) throw new Error("SIMKL_CLIENT_ID is required. Add it to .env.local.");
  const url = new URL("https://data.simkl.in/calendar/v2/tv.json");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("app-name", "hanstream");
  url.searchParams.set("app-version", "0.1.0");
  const response = await fetch(url, { headers: simklHeaders(), next: { revalidate: 18000 }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Simkl calendar returned ${response.status}`);
  const data = await response.json() as { calendar: { simkl_id: number; date: string; episode?: { season?: number; episode?: number } }[]; metadata: Record<string, SimklItem> };
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const days: ScheduleResponse["result"]["days"] = Object.fromEntries(names.map((day) => [day.toLowerCase(), { count: 0, day, dramas: [] }]));
  const now = Date.now();
  const end = now + 7 * 86400000;
  for (const entry of data.calendar || []) {
    const timestamp = Date.parse(entry.date);
    if (timestamp < now || timestamp > end) continue;
    const show = data.metadata?.[entry.simkl_id];
    if (!show) continue;
    const day = names[new Date(timestamp).getUTCDay()].toLowerCase();
    const row: ScheduleDrama = { countdown: new Date(timestamp).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", timeZone: "UTC" }), countdown_seconds: Math.floor((timestamp - now) / 1000), detail_link: `/${entry.simkl_id}`, episode_count: entry.episode?.episode || 0, external_link: simklLink(show), image: simklPoster(show.poster), release_status: "upcoming", release_timestamp: timestamp, slug: `${entry.simkl_id}-${entry.date}`, subtitle_type: null, title: show.title };
    days[day].dramas.push(row);
    days[day].count++;
  }
  return { error: null, page: "schedule", result: { days, schedule_note: "Upcoming episodes from Simkl (UTC)" }, status: 200 };
}

export const fetchRecentCached = fetchRecent;
export const fetchPopularCached = fetchPopular;
export const fetchHotSeriesCached = fetchHotSeries;
export const fetchDramaCached = fetchDrama;
export const fetchEpisodeCached = fetchEpisode;
export const fetchSearchCached = fetchSearch;

export async function fetchSearchClient(query: string, page = 1): Promise<SearchResponse> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&page=${page}`);
  if (!response.ok) throw new Error(`Search failed ${response.status}`);
  return response.json();
}

export function clearCache() { /* Server fetch revalidation is managed by Next.js. */ }
export function clearCacheByPattern(_pattern: string) { /* Server fetch revalidation is managed by Next.js. */ }
export async function preloadHomeData() { await Promise.all([fetchRecent(), fetchPopular()]); }
export async function batchRequests<T>(requests: (() => Promise<T>)[], batchSize = 3): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < requests.length; i += batchSize) results.push(...await Promise.all(requests.slice(i, i + batchSize).map((request) => request())));
  return results;
}
export function formatRelativeTime(value: string): string {
  if (!value || /ago|trending/i.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return date.toLocaleDateString();
}
