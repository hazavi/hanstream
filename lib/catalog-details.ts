import "server-only";
import { readHtml } from "./html";
import { getSourceConfig } from "./server-config.mjs";
import { normalizeTitle } from "./catalog";
import { createKeyedCache } from "./runtime-cache";
import { parseCatalogSearch, parseCatalogDetails, parseCatalogEpisodes, parseMediaSearch } from "./catalog-reader.mjs";
import type { DetailRecord } from "./details";
import { lookupMetadata } from "./metadata-source.mjs";
import { findAlbumPoster } from './album-reader';
import { findPublishedCover } from './cover-reader';
import { findReferenceDetail } from './reference-reader';

type SearchTitle = { title: string; url: string; year?: number; country?: string; image?: string; movie?: boolean };
const asian = (country: string) => /korea|japan|china|taiwan|hong kong|thailand|philippines|singapore|malaysia|indonesia|vietnam|india|pakistan|nepal|sri lanka|cambodia|laos|myanmar|mongolia/i.test(country);
const asianLanguage = (value: unknown) => /Korean|Japanese|Chinese|Mandarin|Cantonese|Thai|Vietnamese|Tagalog|Filipino|Malay|Indonesian|Hindi|Tamil|Telugu/i.test(String(value || ''));
let activeReads = 0;
const waiting: (() => void)[] = [];
async function catalogRead(url: string) {
  if (activeReads >= 4) await new Promise<void>(resolve => waiting.push(resolve)); else activeReads++;
  try { return await readHtml(url, 3600, 4500); }
  finally { const next = waiting.shift(); if (next) next(); else activeReads--; }
}
const searches = createKeyedCache<SearchTitle[]>(async title => {
  const { catalogOrigin } = getSourceConfig();
  return catalogOrigin ? parseCatalogSearch(await catalogRead(`${catalogOrigin}/search?q=${encodeURIComponent(title)}`), catalogOrigin) : [];
});
const profiles = createKeyedCache<DetailRecord>(async url => parseCatalogDetails(await catalogRead(url), url) as DetailRecord);
export function searchCatalogTitles(query: string) { return searches(normalizeTitle(query)); }
const eligible = (record: DetailRecord) => record.country ? asian(record.country) : asianLanguage(record.meta.Language);
async function resolveProfile(title: string, year?: number, season?: number): Promise<DetailRecord | null> {
  const candidates = (await searchCatalogTitles(title)).filter(item => !year || item.year === year || season && item.year && item.year < year);
  const exact = candidates.filter(item => normalizeTitle(item.title) === normalizeTitle(title));
  for (const candidate of (exact.length ? exact : candidates).slice(0, 3)) {
    if (candidate.country && !asian(candidate.country)) continue;
    const record = await profiles(candidate.url);
    if ([record.title, ...(record.aliases || [])].some(alias => normalizeTitle(alias) === normalizeTitle(title)) && eligible(record)) return { ...record, meta: { ...record.meta } };
  }
  return null;
}
export const findCatalogArtwork = createKeyedCache<string | undefined>(async key => {
  const { title, year, secondary } = JSON.parse(key);
  if (!secondary) {
    try {
      const items = await searchCatalogTitles(title);
      const exact = items.filter(item => normalizeTitle(item.title) === normalizeTitle(title) && (!year || item.year === year) && (!item.country || asian(item.country)));
      if (exact.length === 1 && exact[0].image) return exact[0].image;
      const image = (await resolveProfile(title, year))?.image;
      if (image && image !== '/file.svg') return image;
    } catch { /* The independent artwork reader remains available. */ }
    const baseTitle = String(title).replace(/\s+season\s+\d+$/i, '');
    if (baseTitle !== title) {
      try {
        const base = (await searchCatalogTitles(baseTitle)).filter(item => normalizeTitle(item.title) === normalizeTitle(baseTitle) && item.country && asian(item.country));
        if (base.length === 1 && base[0].image) return base[0].image;
        const seriesImage = (await resolveProfile(baseTitle))?.image;
        if (seriesImage && seriesImage !== '/file.svg') return seriesImage;
      } catch { /* A season can still use another published cover. */ }
    }
  }
  const metadata = async () => {
    const exact=await lookupMetadata(title,year,false,readHtml);
    const candidate=exact || (year ? await lookupMetadata(title,undefined,false,readHtml) : null);
    return candidate && (!year || !candidate.year || candidate.year===year) && candidate.image!=='/file.svg' ? candidate.image : undefined;
  };
  try {
    return await Promise.any([findAlbumPoster(title,year),metadata(),findReferenceDetail(title,year).then(record=>record?.image),findPublishedCover(title,year)].map(promise=>promise.then(image=>{if(image&&image!=='/file.svg')return image;throw new Error('No published poster');})));
  } catch { return undefined; }
}, 900_000, 100, 5000);
export async function searchAsianCatalog(query: string) {
  const rows = await searchCatalogTitles(query);
  const known = rows.filter(item => item.country && asian(item.country));
  const unknown = rows.filter(item => !item.country).slice(0, 3);
  const extra = await Promise.allSettled(unknown.map(async item => {
    const record = await profiles(item.url);
    return eligible(record) ? { ...item, image: record.image, country: record.country } : null;
  }));
  return [...known, ...extra.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : [])].map(item => ({ ...item, image: item.image || '/file.svg' }));
}

const lookup = createKeyedCache<DetailRecord | null>(async key => {
  const { title, year } = JSON.parse(key) as { title: string; year?: number };
  const { catalogOrigin, mediaOrigin } = getSourceConfig();
  if (!catalogOrigin) return null;
  const seasonMatch = /^(.*?)\s+season\s+(\d+)$/.exec(title);
  const searchTitle = seasonMatch ? seasonMatch[1] : title;
  const selectedSeason = seasonMatch ? Number(seasonMatch[2]) : undefined;
  const record = await resolveProfile(searchTitle, year, selectedSeason);
  if (!record) return null;
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
