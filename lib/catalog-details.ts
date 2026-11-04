import "server-only";
import { readHtml } from "./html";
import { getSourceConfig } from "./server-config.mjs";
import { normalizeTitle } from "./catalog";
import { createKeyedCache } from "./runtime-cache";
import { parseCatalogSearch, parseCatalogDetails, parseCatalogEpisodes, parseMediaSearch } from "./catalog-reader.mjs";
import type { DetailRecord } from "./details";

const lookup = createKeyedCache<DetailRecord | null>(async key => {
  const { title, year } = JSON.parse(key) as { title: string; year?: number };
  const { catalogOrigin, mediaOrigin } = getSourceConfig();
  if (!catalogOrigin) return null;
  const seasonMatch = /^(.*?)\s+season\s+(\d+)$/.exec(title);
  const searchTitle = seasonMatch ? seasonMatch[1] : title;
  const selectedSeason = seasonMatch ? Number(seasonMatch[2]) : undefined;
  const candidates = parseCatalogSearch(await readHtml(`${catalogOrigin}/search?q=${encodeURIComponent(searchTitle)}`, 3600), catalogOrigin);
  const match = candidates.find((item: { title: string; year?: number }) => normalizeTitle(item.title) === normalizeTitle(searchTitle) && (!year || item.year === year || selectedSeason && item.year && item.year < year));
  if (!match) return null;
  const record = parseCatalogDetails(await readHtml(match.url, 3600), match.url) as DetailRecord;
  if (year && !selectedSeason && record.year !== year) return null;
  const mediaTitle = selectedSeason ? `${record.title} Season ${selectedSeason}` : record.title;
  const [episodes, trailer] = await Promise.allSettled([
    readHtml(record.episodesUrl!, 3600).then(html => parseCatalogEpisodes(html, record.episodesUrl!)),
    mediaOrigin ? readHtml(`${mediaOrigin}/results?search_query=${encodeURIComponent(`"${mediaTitle}" official trailer`)}&hl=en`, 21600, 5000).then(html => parseMediaSearch(html, mediaTitle)) : Promise.resolve(null),
  ]);
  record.episodes = episodes.status === "fulfilled" ? episodes.value : [];
  if (selectedSeason) {
    record.episodes = record.episodes.filter(episode => episode.season === selectedSeason);
    if (!record.episodes.length || year && !record.episodes.some(episode => episode.date?.startsWith(String(year)))) return null;
    record.title = `${record.title} Season ${selectedSeason}`;
    if (record.year) record.meta["Series premiere"] = record.year;
    record.year = year || Number(record.episodes[0].date?.slice(0, 4)) || record.year;
    if (record.year) record.meta.Released = record.year;
  }
  if (trailer.status === "fulfilled" && trailer.value) record.trailer = trailer.value;
  if (record.episodes.length) {
    record.meta.Episodes = record.episodes.length;
    record.meta.Seasons = new Set(record.episodes.map(episode => episode.season)).size;
    const dates = record.episodes.map(episode => episode.date).filter((date): date is string => Boolean(date)).sort();
    if (dates.length) record.meta["Air Date"] = `${dates[0]} – ${dates.at(-1)}`;
  }
  return record;
});

export function findCatalogDetails(title: string, year?: number) {
  return lookup(JSON.stringify({ title: normalizeTitle(title), year }));
}
