import 'server-only';
import {load} from 'cheerio';
import {getSourceConfig} from './server-config.mjs';
import {createKeyedCache} from './runtime-cache';
import {readCatalogHtml} from './catalog-search';
import {parseCatalogBrowse} from './catalog-reader.mjs';
import {catalogRoute, type CatalogTitle} from './catalog';

export type BrowseCategory = 'popular' | 'popular-new' | 'ongoing' | 'ongoing-kshows';
type Scope = {language: string; type: string};
type Filters = {languages: Record<string,string>; types: Record<string,string>; states: Record<string,string>; sorts: Record<string,string>};
const settings = createKeyedCache<Filters>(async () => {
  const {catalogOrigin} = getSourceConfig();
  if (!catalogOrigin) throw new Error('The drama catalog is unavailable.');
  const $ = load(await readCatalogHtml(`${catalogOrigin}/shows`));
  const options = (name: string) => Object.fromEntries($('select').filter((_,el) => $(el).attr('name') === `Show[${name}]`).find('option[value]').map((_,el) => ({label: $(el).text().trim(), value: $(el).attr('value')!})).get().filter(item => item.value).map(item => [item.label,item.value]));
  return {languages: options('language_enum'), types: options('showType_enum'), states: options('showStatus_enum'), sorts: options('sort')};
}, 21_600_000);

const batches = createKeyedCache<{items: CatalogTitle[]; hasNext: boolean}>(async key => {
  const {category, page, year} = JSON.parse(key) as {category: BrowseCategory; page: number; year: number};
  const {catalogOrigin} = getSourceConfig(), config = await settings('filters');
  const scopes: Scope[] = category === 'ongoing-kshows'
    ? ['Variety','Reality','Game Show','Talk Show'].filter(type => config.types[type]).map(type => ({language: 'Korean', type}))
    : ['Korean','Japanese','Chinese','Thai'].filter(language => config.languages[language]).map(language => ({language, type: 'Scripted'}));
  if (!scopes.length) throw new Error('Published drama filters are unavailable.');
  const results = await Promise.allSettled(scopes.map(async scope => {
    const filters: Record<string,string> = {'Show[language_enum]': config.languages[scope.language], 'Show[showType_enum]': config.types[scope.type], 'Show[sort]': config.sorts[category === 'popular' ? 'Most followed' : 'Most popular']};
    if (category.startsWith('ongoing')) filters['Show[showStatus_enum]'] = config.states.Running;
    if (category === 'popular-new') filters['Show[premiereFrom]'] = String(year - 1);
    if (Object.values(filters).some(value => !value)) throw new Error('Published drama filters are unavailable.');
    const query = new URLSearchParams({...filters, ...(page > 1 ? {page: String(page - 1)} : {})});
    return parseCatalogBrowse(await readCatalogHtml(`${catalogOrigin}/shows?${query}`), catalogOrigin, filters) as {items: CatalogTitle[]; hasNext: boolean};
  }));
  if (results.every(result => result.status === 'rejected')) throw new AggregateError(results.map(result => result.reason), 'Drama listings are temporarily unavailable.');
  const lists = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  // Interleave each published ranking, keeping its order stable across pages.
  const items: CatalogTitle[] = [];
  for (let index = 0; index < Math.max(0,...lists.map(list => list.items.length)); index++) for (const list of lists) if (list.items[index]) items.push(list.items[index]);
  return {items, hasNext: lists.some(list => list.hasNext)};
}, 900_000);

export async function browseAsianDramas(category: BrowseCategory, page = 1) {
  const year = Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Copenhagen',year:'numeric'}).format(new Date()));
  const records = new Map<string,CatalogTitle>();
  const end = page * 20;
  let hasNext = true, sourcePage = 1;
  // Cached batches are shared across page requests. Only discover another batch
  // when the requested page needs it, with a fixed upper bound on source fan-out.
  for (; sourcePage <= 8 && hasNext && records.size <= end; sourcePage++) {
    const batch = await batches(JSON.stringify({category,page:sourcePage,year}));
    batch.items.forEach(item => { const route = catalogRoute(item); if (!records.has(route)) records.set(route,item); });
    hasNext = batch.hasNext;
  }
  const items = [...records.values()];
  return {items: items.slice((page - 1) * 20,end), hasNext: items.length > end || hasNext && sourcePage <= 8};
}
