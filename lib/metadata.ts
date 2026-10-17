import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { readHtml } from "./html";
import { createRuntimeCache } from "./runtime-cache";
import { catalogRoute, normalizeTitle, type CatalogTitle } from "./catalog";
import { collectMetadata, homepageSections, lookupMetadata, matchMetadata, rankingLists } from "./metadata-source.mjs";

export { HOME_LABELS } from "./metadata-source.mjs";
export type HomeSection = "reviews" | "trending" | "starting" | "ending";
export type Ranking = "airing" | "upcoming" | "popular";
export type MetadataTitle = CatalogTitle & { sourceName: string; indexOnly?: boolean; aliases?: string[]; meta?: Record<string, string | number>; overview?: string; otherNames?: string; startDate?: string; endDate?: string };
type Editorial = { titles: MetadataTitle[]; trending: MetadataTitle[]; popular: MetadataTitle[]; reviews: MetadataTitle[] };
export type MetadataSnapshot = { version: 2; fetchedAt: string; titles: MetadataTitle[]; airingUrls: string[]; editorial: Editorial; sources: string[] };

const liveMetadata = createRuntimeCache<MetadataSnapshot>(async previous =>
  collectMetadata(readHtml, { previous, limit: 60 }) as Promise<MetadataSnapshot>, 21_600_000);

export const getMetadata = cache(liveMetadata);
export const getHomepage = cache(async (): Promise<Record<HomeSection, CatalogTitle[]>> => {
  const sections = homepageSections(await getMetadata()) as Record<HomeSection, MetadataTitle[]>;
  return Object.fromEntries(Object.entries(sections).map(([section, items]) => [section, items.map(item => ({
    title: item.title, image: item.image, year: item.year, movie: item.movie,
    url: catalogRoute(item), date: item.date, note: item.note,
  }))])) as Record<HomeSection, CatalogTitle[]>;
});
export async function getMetadataList(kind: Ranking, page = 1): Promise<MetadataTitle[]> {
  const lists = rankingLists(await getMetadata()) as Record<Ranking, MetadataTitle[]>;
  const current = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  return lists[kind].slice((current - 1) * 20, current * 20);
}

const lookup = unstable_cache(async (title: string, year?: number, movie = false): Promise<MetadataTitle | null> => {
  try { return await lookupMetadata(title, year, movie, readHtml) as MetadataTitle | null; }
  catch { return null; }
}, ["metadata-title-v2"], { revalidate: 21600 });

export async function findMetadata(title: string, year?: number, movie = false): Promise<MetadataTitle | null> {
  const saved = await getMetadata();
  const item = matchMetadata(saved.titles, title, year, movie) as MetadataTitle | undefined;
  return item && !item.indexOnly ? item : await lookup(title, year, movie) || item || null;
}

export async function enrichArtwork<T extends CatalogTitle>(items: T[]): Promise<T[]> {
  const snapshot = await getMetadata();
  const catalog = [...snapshot.titles, ...snapshot.editorial.titles.map(item => {
    const detail = matchMetadata(snapshot.titles, item.title) as MetadataTitle | undefined;
    return { ...item, year: detail?.year };
  })];
  return items.map(item => {
    if (item.image && item.image !== "/file.svg") return item;
    const detail = matchMetadata(catalog, item.title, item.year, Boolean(item.movie)) as MetadataTitle | undefined;
    return detail?.image && detail.image !== "/file.svg" ? { ...item, image: detail.image } : item;
  });
}

export async function searchMetadata(query: string, page = 1): Promise<MetadataTitle[]> {
  const snapshot = await getMetadata();
  const key = normalizeTitle(query);
  const items = [...new Map([...snapshot.editorial.titles, ...snapshot.titles].map(item => [normalizeTitle(item.title), item])).values()];
  const matches = items.filter(item => [item.title, ...(item.aliases || [])].some(alias => normalizeTitle(alias).includes(key)));
  const current = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  return matches.slice((current - 1) * 20, current * 20);
}
