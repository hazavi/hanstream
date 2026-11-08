import 'server-only';
import {readHtml} from './html';
import {getSourceConfig} from './server-config.mjs';
import {normalizeTitle} from './catalog';
import {createKeyedCache} from './runtime-cache';
import {parseCatalogSearch, parseCatalogDetails, parseCatalogPageHasNext} from './catalog-reader.mjs';
import {hasAsianOrigin} from './catalog-policy';
import type {DetailRecord} from './details';

export type SearchTitle = {title: string; url: string; year?: number; country?: string; image?: string; movie?: boolean};
let active = 0;
const waiting: (() => void)[] = [];
export async function readCatalogHtml(url: string) {
  if (active >= 4) await new Promise<void>(resolve => waiting.push(resolve)); else active++;
  try { return await readHtml(url, 1800, 6000); }
  finally { const next = waiting.shift(); if (next) next(); else active--; }
}
const searches = createKeyedCache<{items: SearchTitle[]; hasNext: boolean}>(async key => {
  const {query, page} = JSON.parse(key), {catalogOrigin} = getSourceConfig();
  if (!catalogOrigin) return {items: [], hasNext: false};
  const html = await readCatalogHtml(`${catalogOrigin}/search?${new URLSearchParams({q: query, ...(page > 1 ? {page: String(page - 1)} : {})})}`);
  return {items: parseCatalogSearch(html, catalogOrigin), hasNext: parseCatalogPageHasNext(html,catalogOrigin)};
}, 300_000);
export const getCatalogProfile = createKeyedCache<DetailRecord>(async url => parseCatalogDetails(await readCatalogHtml(url), url) as DetailRecord);
export function searchCatalogPage(query: string, page = 1) { return searches(JSON.stringify({query: normalizeTitle(query), page})); }
export async function searchCatalogTitles(query: string, page = 1) { return (await searchCatalogPage(query,page)).items; }
export async function resolveAsianIdentity(title: string, year?: number, season?: number): Promise<DetailRecord | null> {
  const candidates = (await searchCatalogTitles(title)).filter(item => !year || !item.year || item.year === year || season && item.year < year);
  const exact = candidates.filter(item => normalizeTitle(item.title) === normalizeTitle(title));
  for (const candidate of (exact.length ? exact : candidates).slice(0, 6)) {
    if (candidate.country && !hasAsianOrigin(candidate.country)) continue;
    try {
      const record = await getCatalogProfile(candidate.url);
      if (year && record.year !== year && !(season && record.year && record.year < year)) continue;
      if ([record.title, ...(record.aliases || [])].some(alias => normalizeTitle(alias) === normalizeTitle(title)) && hasAsianOrigin(record.country, record.meta.Language)) return {...record, meta: {...record.meta}};
    } catch { /* A missing candidate must not prevent a verified Asian match. */ }
  }
  return null;
}
