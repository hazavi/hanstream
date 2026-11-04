import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { readHtml } from "./html";
import { createRuntimeCache } from "./runtime-cache";
import { catalogRoute, normalizeTitle, type CatalogTitle } from "./catalog";
import { collectMetadata, homepageSections, lookupMetadata, matchMetadata, rankingLists } from "./metadata-source.mjs";
import { findCatalogArtwork } from "./catalog-details";
import type { DramaCast } from './api-types';

export { HOME_LABELS } from "./metadata-source.mjs";
export type HomeSection = "reviews" | "trending" | "starting" | "ending";
export type Ranking = "airing" | "upcoming" | "popular";
export type MetadataTitle = CatalogTitle & { sourceName: string; indexOnly?: boolean; aliases?: string[]; cast?: DramaCast[]; meta?: Record<string, string | number>; overview?: string; otherNames?: string; startDate?: string; endDate?: string };
type Editorial = { titles: MetadataTitle[]; trending: MetadataTitle[]; popular: MetadataTitle[]; reviews: MetadataTitle[] };
export type MetadataSnapshot = { version: 2; fetchedAt: string; titles: MetadataTitle[]; airingUrls: string[]; editorial: Editorial; sources: string[] };

const liveMetadata = createRuntimeCache<MetadataSnapshot>(async previous => {
  const first = await collectMetadata(readHtml, { previous, limit: 12 }) as MetadataSnapshot;
  void collectMetadata(readHtml, { previous: first, limit: 60 }).then((next: MetadataSnapshot) => liveMetadata.prime(next)).catch(() => {});
  return first;
}, 21_600_000);

export const getMetadata = cache(liveMetadata);
export const getHomepage = cache(async (): Promise<Record<HomeSection, CatalogTitle[]>> => {
  const sections = homepageSections(await getMetadata()) as Record<HomeSection, MetadataTitle[]>;
  await Promise.all((Object.keys(sections) as HomeSection[]).map(async section => { sections[section] = await enrichArtwork(sections[section]); }));
  return Object.fromEntries(Object.entries(sections).map(([section, items]) => [section, items.map(item => ({
    title: item.title, image: item.image, year: item.year, movie: item.movie,
    url: catalogRoute(item), date: item.date, note: item.note,
  }))])) as Record<HomeSection, CatalogTitle[]>;
});
export async function getMetadataList(kind: Ranking, page = 1): Promise<MetadataTitle[]> {
  const lists = rankingLists(await getMetadata()) as Record<Ranking, MetadataTitle[]>;
  const current = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  return enrichArtwork(lists[kind].slice((current - 1) * 20, current * 20));
}

const lookup = unstable_cache(async (title: string, year?: number, movie = false): Promise<MetadataTitle | null> => {
  try { return await lookupMetadata(title, year, movie, readHtml) as MetadataTitle | null; }
  catch { return null; }
}, ["metadata-title-v3"], { revalidate: 21600 });

export async function findMetadata(title: string, year?: number, movie = false): Promise<MetadataTitle | null> {
  const saved = liveMetadata.peek?.();
  const item = saved ? matchMetadata(saved.titles, title, year, movie) as MetadataTitle | undefined : undefined;
  return item && !item.indexOnly ? item : await lookup(title, year, movie) || item || null;
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
  await Promise.all([0, 1, 2, 3].map(async () => {
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
  return result;
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
