import { getSourceConfig } from './server-config.mjs';
import { parseEditorialHomepage, parseMetadataDetail, parseMetadataIndex, parseMetadataSearch, titleKey } from './metadata-parser.mjs';

const sources = getSourceConfig();
export const METADATA_SOURCES = {
  airing: { name: 'Metadata', url: `${sources.metadataOrigin}/Category:Airing_Dramas`, note: 'Currently airing, alphabetical' },
  upcoming: { name: 'Metadata', url: `${sources.metadataOrigin}/Upcoming_KDrama`, note: 'Confirmed premieres, soonest first' },
  popular: { name: 'Editorial', url: `${sources.editorialCanonicalOrigin}/#most_reviewed`, note: 'Most viewed order' },
};
export const HOME_LABELS = { reviews: 'Latest Reviews', trending: 'Trending This Week', starting: 'Shows Starting This Week', ending: 'Shows Ending This Week' };
const indexes = [METADATA_SOURCES.airing.url, METADATA_SOURCES.upcoming.url, `${sources.metadataOrigin}/Upcoming_JDrama`, `${sources.metadataOrigin}/Upcoming_CDrama`];

export function matchMetadata(items, title, year, movie = false) {
  const matches = items.filter(item => Boolean(item.movie) === movie && [item.title, ...(item.aliases || [])].some(alias => titleKey(alias) === titleKey(title)));
  if (year) return matches.find(item => item.year === year);
  return matches.length === 1 ? matches[0] : undefined;
}

export async function lookupMetadata(title, year, movie, read) {
  if (movie) return null;
  const address = `${sources.metadataOrigin}/index.php?search=${encodeURIComponent(title)}`;
  const html = await read(address);
  // The page configuration identifies exact-match search redirects.
  const pageName = html.match(/"wgPageName":("(?:[^"\\]|\\.)*")/)?.[1];
  const canonical = pageName ? `${sources.metadataOrigin}/${encodeURIComponent(JSON.parse(pageName))}` : undefined;
  let detail = canonical ? parseMetadataDetail(html, canonical) : null;
  if (!detail) {
    const target = parseMetadataSearch(html, title);
    if (target) detail = parseMetadataDetail(await read(target), target);
  }
  return detail && matchMetadata([detail], title, year, movie) ? detail : null;
}

function mergeEditorial(item, titles) {
  const match = matchMetadata(titles, item.title);
  return match ? { ...match, ...item, year: match.year, meta: match.meta, startDate: match.startDate, endDate: match.endDate, aliases: match.aliases } : item;
}

export function homepageSections(snapshot, now = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const monday = new Date(`${day}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const end = new Date(monday); end.setUTCDate(end.getUTCDate() + 7);
  const weekStart = monday.toISOString().slice(0, 10), weekEnd = end.toISOString().slice(0, 10);
  const inWeek = date => {
    if (!date || !Number.isFinite(Date.parse(date))) return false;
    const local = date.length === 10 ? date : new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
    return local >= weekStart && local < weekEnd;
  };
  const editorial = snapshot.editorial;
  const reviews = editorial.reviews.map(item => mergeEditorial(item, snapshot.titles)).slice(0, 6);
  // Weekly coverage defines this subset; preserve the source's trending order.
  const covered = new Set(editorial.reviews.filter(item => inWeek(item.date)).map(item => titleKey(item.title)));
  const trending = editorial.trending.filter(item => covered.has(titleKey(item.title))).map(item => ({ ...mergeEditorial(item, snapshot.titles), note: 'Featured this week' })).slice(0, 6);
  const dated = field => snapshot.titles.filter(item => inWeek(item[field])).sort((a,b) => a[field].localeCompare(b[field])).map(item => ({ ...item, date: item[field], note: new Date(item[field] + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Copenhagen' }) }));
  return { reviews, trending, starting: dated('startDate'), ending: dated('endDate') };
}

export function rankingLists(snapshot, now = new Date()) {
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Copenhagen' });
  const airing = snapshot.titles.filter(item => (!item.startDate || item.startDate <= today) && (item.endDate ? item.endDate >= today : snapshot.airingUrls.includes(item.url))).sort((a,b) => a.title.localeCompare(b.title));
  const upcoming = snapshot.titles.filter(item => item.startDate && item.startDate > today).sort((a,b) => a.startDate.localeCompare(b.startDate));
  return { airing, upcoming, popular: snapshot.editorial.popular.map(item => mergeEditorial(item, snapshot.titles)) };
}

/** @param {Function} read
 * @param {{previous?: any, extraTitles?: any[], now?: Date, limit?: number, onProgress?: (done: number, total: number) => void}} options */
export async function collectMetadata(read, { previous, extraTitles = [], now = new Date(), limit = 180, onProgress = () => {} } = {}) {
  const pages = await Promise.allSettled([sources.editorialOrigin, ...indexes].map(address => read(address)));
  if (previous && pages.every(result => result.status === 'rejected')) return previous;
  const freshEditorial = pages[0].status === 'fulfilled' ? parseEditorialHomepage(pages[0].value) : null;
  const editorial = freshEditorial?.titles.length && freshEditorial.reviews.length ? freshEditorial : previous?.editorial;
  if (!editorial) throw new Error('The editorial source did not return its public catalog. Previous metadata was preserved.');
  const rows = pages.slice(1).flatMap(result => result.status === 'fulfilled' ? parseMetadataIndex(result.value) : []);
  const airingUrls = rows.filter(item => item.airing).map(item => item.url);
  const known = new Map((previous?.titles || []).map(item => [item.url, item]));
  // Published index dates can refresh schedules without crawling detail pages during a web request.
  for (const row of rows.filter(item => item.startDate || item.airing)) {
    if (known.has(row.url)) continue;
    const cover = editorial.titles.find(item => titleKey(item.title) === titleKey(row.title));
    const year = row.startDate ? Number(row.startDate.slice(0, 4)) : undefined;
    known.set(row.url, { title: row.title, url: row.url, image: cover?.image || '/file.svg', startDate: row.startDate, year, movie: false, sourceName: 'Metadata', indexOnly: true, meta: year ? { Released: year } : {} });
  }
  const dated = rows.filter(item => item.startDate).sort((a,b) => a.startDate.localeCompare(b.startDate));
  // Refresh current titles first, then published schedules, then undated upcoming pages.
  const queue = [...rows.filter(item => item.airing), ...editorial.titles, ...extraTitles, ...dated, ...rows].filter(item => !item.movie);
  const unique = [...new Map(queue.map(item => [titleKey(item.title), item])).values()].slice(0, limit);
  let completed = 0;
  for (let i = 0; i < unique.length; i += 3) {
    await Promise.all(unique.slice(i, i + 3).map(async item => {
      try {
        const detail = item.url && new URL(item.url).origin === sources.metadataOrigin ? parseMetadataDetail(await read(item.url), item.url) : await lookupMetadata(item.title, item.year, false, read);
        if (detail) known.set(detail.url, detail);
      } catch { /* Keep the previously verified title when an individual page fails. */ }
      completed++; onProgress(completed, unique.length);
    }));
    if (i + 3 < unique.length) await new Promise(resolve => setTimeout(resolve, 250));
  }
  const titles = [...known.values()];
  if (!titles.length) throw new Error('No metadata detail pages were available. Previous metadata was preserved.');
  return { version: 2, fetchedAt: now.toISOString(), sources: [sources.metadataOrigin, sources.editorialOrigin], editorial, titles, airingUrls: airingUrls.length ? airingUrls : previous?.airingUrls || [] };
}
