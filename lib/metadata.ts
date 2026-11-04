import "server-only";
import { cache } from "react";
import { readHtml } from "./html";
import { createRuntimeCache, createKeyedCache } from "./runtime-cache";
import { catalogRoute, normalizeTitle, type CatalogTitle } from "./catalog";
import { collectMetadata, homepageSections, lookupMetadata, matchMetadata, rankingLists } from "./metadata-source.mjs";
import { findCatalogArtwork } from "./catalog-details";
import type { DramaCast } from './api-types';
import { getCalendarTitles, type CalendarTitle } from './calendar-reader';

export { HOME_LABELS } from "./metadata-source.mjs";
export type HomeSection = "reviews" | "trending" | "starting" | "ending";
export type Ranking = "airing" | "upcoming" | "popular";
export type MetadataTitle = CatalogTitle & { sourceName: string; indexOnly?: boolean; airing?:boolean;upcoming?:boolean; aliases?: string[]; cast?: DramaCast[]; meta?: Record<string, string | number>; overview?: string; otherNames?: string; startDate?: string; endDate?: string };
type Editorial = { titles: MetadataTitle[]; trending: MetadataTitle[]; popular: MetadataTitle[]; reviews: MetadataTitle[] };
export type MetadataSnapshot = { version: 2; fetchedAt: string; titles: MetadataTitle[]; airingUrls: string[]; editorial: Editorial; sources: string[] };

function mergeCalendar(snapshot:MetadataSnapshot,items:CalendarTitle[]):MetadataSnapshot {
  const titles=[...snapshot.titles];
  for(const item of items){const index=titles.findIndex(old=>normalizeTitle(old.title)===normalizeTitle(item.title)&&(!old.year||!item.year||old.year===item.year));
    const old=titles[index];const next=old?{...item,...old,airing:item.airing,upcoming:item.upcoming,year:old.year||item.year,startDate:old.startDate||item.startDate,endDate:old.endDate||item.endDate,image:old.image&&old.image!='/file.svg'?old.image:item.image,meta:{...item.meta,...old.meta}}:item;
    if(index<0)titles.push(next);else titles[index]=next;
  }return {...snapshot,titles};
}
const liveMetadata = createRuntimeCache<MetadataSnapshot>(async previous => {
  const [main,calendar]=await Promise.allSettled([collectMetadata(readHtml,{previous,limit:12}),getCalendarTitles()]);
  if(main.status==='rejected'&&calendar.status==='rejected')throw main.reason;
  const base=main.status==='fulfilled'?main.value as MetadataSnapshot:previous||{version:2 as const,fetchedAt:new Date().toISOString(),titles:[],airingUrls:[],editorial:{titles:[],trending:[],popular:[],reviews:[]},sources:[]};
  const items=calendar.status==='fulfilled'?calendar.value:[];
  const first=mergeCalendar(base,items);
  void collectMetadata(readHtml, { previous: first, limit: 60 }).then((next: MetadataSnapshot) => liveMetadata.prime(mergeCalendar(next,items))).catch(() => {});
  return first;
}, 21_600_000);

export const getMetadata = cache(liveMetadata);
async function datedMetadata() {
  const [snapshot,calendar]=await Promise.all([getMetadata(),getCalendarTitles().catch(()=>[])]);
  return mergeCalendar(snapshot,calendar);
}
export const getHomepage = cache(async (): Promise<Record<HomeSection, CatalogTitle[]>> => {
  const sections = homepageSections(await datedMetadata()) as Record<HomeSection, MetadataTitle[]>;
  // One worker pool for all sections, including titles appearing in several grids.
  const keys = Object.keys(sections) as HomeSection[];
  const enriched = await enrichArtwork(keys.flatMap(section => sections[section]));
  let offset = 0;
  for (const section of keys) {
    const length = sections[section].length;
    sections[section] = enriched.slice(offset, offset + length);
    offset += length;
  }
  return Object.fromEntries(Object.entries(sections).map(([section, items]) => [section, items.map(item => ({
    title: item.title, image: item.image, year: item.year, movie: item.movie,
    url: catalogRoute(item), date: item.date, note: item.note,
  }))])) as Record<HomeSection, CatalogTitle[]>;
});
export async function getMetadataList(kind: Ranking, page = 1): Promise<MetadataTitle[]> {
  const lists = rankingLists(await datedMetadata()) as Record<Ranking, MetadataTitle[]>;
  const current = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  return enrichArtwork(lists[kind].slice((current - 1) * 20, current * 20));
}

const lookup = createKeyedCache<MetadataTitle | null>(async key => {
  const {title,year,movie}=JSON.parse(key);
  try { return await lookupMetadata(title, year, movie, readHtml) as MetadataTitle | null; }
  catch { return null; }
}, 21_600_000);

export async function findMetadata(title: string, year?: number, movie = false): Promise<MetadataTitle | null> {
  const saved = liveMetadata.peek?.();
  const item = saved ? matchMetadata(saved.titles, title, year, movie) as MetadataTitle | undefined : undefined;
  return item && !item.indexOnly ? item : await lookup(JSON.stringify({title,year,movie})) || item || null;
}

export async function enrichArtwork<T extends CatalogTitle>(items: T[]): Promise<T[]> {
  if (items.every(item => item.image && item.image !== "/file.svg")) return items;
  // A title-specific poster request must not wait for the homepage catalog crawl.
  const snapshot = liveMetadata.peek?.();
  const catalog = [...(snapshot?.titles || []), ...(snapshot?.editorial.titles || []).map(item => {
    const detail = matchMetadata(snapshot?.titles || [], item.title) as MetadataTitle | undefined;
    return { ...item, year: detail?.year };
  })];
  const result = [...items];
  let next = 0;
  const enrichment = Promise.all([0, 1, 2, 3].map(async () => {
    while (next < items.length) {
      const index = next++, item = items[index];
      if (item.image && item.image !== '/file.svg') continue;
      const detail = matchMetadata(catalog, item.title, item.year, Boolean(item.movie)) as MetadataTitle | undefined;
      let image = detail?.image !== '/file.svg' ? detail?.image : undefined;
      if (!image && !item.movie) {
        try { image = await findCatalogArtwork(JSON.stringify({ title: item.title, year: item.year })); } catch { /* Preserve existing live artwork when a lookup fails. */ }
      }
      if (image && image !== '/file.svg') result[index] = { ...item, image };
    }
  }));
  // Render listings promptly; lazy image requests reuse the ongoing cached lookups.
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([enrichment, new Promise<void>(resolve => { timer = setTimeout(resolve, items.length > 1 ? 1000 : 500); })]).finally(() => clearTimeout(timer));
  return [...result];
}

export async function searchMetadata(query: string, page = 1): Promise<MetadataTitle[]> {
  const snapshot = liveMetadata.peek?.();
  if (!snapshot) return [];
  const key = normalizeTitle(query);
  const items = [...new Map([...snapshot.editorial.titles, ...snapshot.titles].map(item => [normalizeTitle(item.title), item])).values()];
  const matches = items.filter(item => [item.title, ...(item.aliases || [])].some(alias => normalizeTitle(alias).includes(key)));
  const current = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  return matches.slice((current - 1) * 20, current * 20);
}
