import "server-only";
import { readHtml } from "./html";
import { getSourceConfig } from "./server-config.mjs";
import { normalizeTitle } from "./catalog";
import { createKeyedCache } from "./runtime-cache";
import { parseCatalogEpisodes, parseMediaSearch } from "./catalog-reader.mjs";
import type { DetailRecord } from "./details";
import { lookupMetadata } from "./metadata-source.mjs";
import { findAlbumPoster } from './album-reader';
import { findPublishedCover } from './cover-reader';
import { findReferenceDetail } from './reference-reader';
import { findSupplementalDetails,findCollectionMoviePoster } from './supplemental-details';
import {getCatalogProfile as profiles, resolveAsianIdentity as resolveProfile, searchCatalogTitles, searchCatalogPage} from './catalog-search';
import {hasAsianOrigin, isAsianCountry as asian} from './catalog-policy';
export {searchCatalogTitles} from './catalog-search';

const eligible = (record: DetailRecord) => hasAsianOrigin(record.country, record.meta.Language);
async function resolveArtwork(key:string):Promise<string|undefined> {
  const { title, year, secondary } = JSON.parse(key);
  if (!secondary) {
    try {
      const items = await searchCatalogTitles(title);
      const exact = items.filter(item => normalizeTitle(item.title) === normalizeTitle(title) && (!year || item.year === year) && (!item.country || asian(item.country)));
      if (exact.length === 1 && exact[0].country && exact[0].image) return exact[0].image;
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
    return await Promise.any([findAlbumPoster(title,year),metadata(),findReferenceDetail(title,year).then(record=>record?.image),findPublishedCover(title,year),findSupplementalDetails(title,year).then(record=>record?.image)].map(promise=>promise.then(image=>{if(image&&image!=='/file.svg')return image;throw new Error('No published poster');})));
  } catch { return undefined; }
}
export const findCatalogArtwork=createKeyedCache<string|undefined>(async key=>{
  const {title,year,movie}=JSON.parse(key);
  if(movie)return findCollectionMoviePoster(title,year);
  return Promise.any([resolveArtwork(key),findPublishedCover(title,year)].map(task=>task.then(image=>{if(image&&image!=='/file.svg')return image;throw new Error('No published poster');}))).catch(()=>undefined);
},900_000,100,5000);
export async function searchAsianCatalogResults(query: string, page = 1, limit = 25) {
  const source = await searchCatalogPage(query, page), rows = source.items;
  const candidates = rows.filter(item => !item.country || asian(item.country)).slice(0,limit);
  const verified = await Promise.allSettled(candidates.map(async item => {
    const record = await profiles(item.url);
    return eligible({...record,country:record.country || item.country}) && record.meta['Show Type'] !== 'Animation' ? { ...item, year: record.year, image: record.image, country: record.country || item.country } : null;
  }));
  return {items: verified.flatMap(result => result.status === 'fulfilled' && result.value ? [{...result.value,image:result.value.image || '/file.svg'}] : []), hasNext: source.hasNext};
}
export async function searchAsianCatalog(query: string, page = 1) { return (await searchAsianCatalogResults(query,page)).items; }

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
