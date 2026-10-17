import { load } from 'cheerio';
import { getSourceConfig } from './server-config.mjs';

const config = getSourceConfig();
const METADATA_BASE = config.metadataOrigin;
const EDITORIAL_BASE = config.editorialCanonicalOrigin;
const text = value => (value || '').replace(/\s+/g, ' ').trim();
export const titleKey = value => text(value).normalize('NFKC').toLowerCase().replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function url(value, base) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try { const result = new URL(value, base); return result.protocol === 'https:' && !result.username && !result.password ? result.href : undefined; } catch { return undefined; }
}
function metadataLink(value) {
  const result = url(value, METADATA_BASE);
  if (!result) return undefined;
  const parsed = new URL(result);
  return parsed.origin === METADATA_BASE && !parsed.search && !parsed.hash && !/\/(?:Category|File|Template|DramaWiki|Help|User|Talk):/.test(parsed.pathname) ? result : undefined;
}

// Accept full published dates only. A year, month, TBA, or episode count is not a date.
export function publishedDate(value) {
  const match = text(value).match(/\b(20\d{2})[-/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2})[-/](\d{1,2})\b/i);
  if (!match) return undefined;
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const month = /^\d+$/.test(match[2]) ? Number(match[2]) : months.indexOf(match[2].toLowerCase()) + 1;
  const date = `${match[1]}-${String(month).padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  return Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date : undefined;
}

export function parseMetadataDetail(html, pageUrl) {
  const $ = load(html);
  const root = $('.mw-parser-output');
  const heading = root.find('#Details').closest('h2,h3');
  if (!heading.length || !metadataLink(pageUrl)) return null;
  const fields = {};
  heading.nextUntil('h2,h3').find('li').each((_, element) => {
    const row = $(element), label = text(row.children('b,strong').first().text()).replace(/:$/, '').toLowerCase();
    if (label) fields[label] = text(row.text()).replace(/^[^:]+:\s*/, '');
  });
  if (!fields.title || !Object.keys(fields).some(key => /genre|broadcast|episodes/.test(key))) return null;
  const title = text($('title').text().replace(/\s*-\s*DramaWiki\s*$/, ''));
  const image = url(root.find('.thumbimage, .floatright img').first().attr('src'), METADATA_BASE) || '/file.svg';
  const period = fields['broadcast period'] || fields['airing period'] || '';
  const startDate = publishedDate(period);
  const endDate = publishedDate(period.split(/\s+(?:to|~|–)\s+/)[1]);
  const cats = $('#catlinks').text();
  const country = /KDrama/.test(cats) ? 'South Korea' : /JDrama/.test(cats) ? 'Japan' : /CDrama/.test(cats) ? 'China' : /TWDrama/.test(cats) ? 'Taiwan' : /HKDrama/.test(cats) ? 'Hong Kong' : /SGDrama/.test(cats) ? 'Singapore' : undefined;
  const year = startDate ? Number(startDate.slice(0, 4)) : Number(cats.match(/(?:K|J|C|TW|HK|SG)Drama(20\d{2})/)?.[1]) || undefined;
  const meta = {};
  for (const [source, label] of [['genre','Genre'],['episodes','Episodes'],['broadcast network','Network'],['broadcast period','Broadcast period'],['air time','Air time']]) if (fields[source]) meta[label] = fields[source];
  if (country) meta.Country = country;
  if (year) meta.Released = year;
  const aliases = [title, fields['english title'], fields.title, fields['also known as']].filter(Boolean).flatMap(value => value.split(/\s*\/\s*|\s*;\s*/));
  // A short factual description avoids reproducing the source's synopsis.
  const overview = [country ? `A drama from ${country}.` : '', fields.genre ? `Genres: ${fields.genre}.` : '', fields['broadcast network'] ? `Broadcast on ${fields['broadcast network']}.` : '', period ? `Broadcast period: ${period}.` : ''].filter(Boolean).join(' ');
  return { title, image, url: pageUrl, year, movie: false, sourceName: 'Metadata', meta, aliases, otherNames: [fields.title, fields['also known as']].filter(Boolean).join(' / '), overview, startDate, endDate };
}

export function parseMetadataSearch(html, query) {
  const $ = load(html);
  let result;
  $('.mw-search-result-heading a').each((_, element) => {
    if (titleKey($(element).text()) === titleKey(query)) result = metadataLink($(element).attr('href'));
  });
  return result;
}

export function parseMetadataIndex(html) {
  const $ = load(html), items = [];
  $('.mw-category a').each((_, element) => {
    const href = metadataLink($(element).attr('href'));
    if (href) items.push({ title: text($(element).text()), url: href, airing: true });
  });
  $('.mw-parser-output table').each((_, table) => {
    const headers = $(table).find('tr').first().find('th,td').map((_, el) => text($(el).text()).toLowerCase()).get();
    const titleColumn = headers.indexOf('title');
    if (titleColumn < 0) return;
    const context = text($(table).prevAll('h2,h3').first().text());
    const year = context.match(/20\d{2}/)?.[0];
    $(table).find('tr').slice(1).each((_, tr) => {
      const cells = $(tr).children('td');
      const anchor = cells.eq(titleColumn).find('a:not(.new)').first();
      const href = metadataLink(anchor.attr('href'));
      if (!href || !anchor.text()) return;
      let date = publishedDate(cells.map((_, el) => text($(el).text())).get().join(' '));
      const monthDay = text($(tr).text()).match(/\(from\s+([A-Z][a-z]{2}-\d{2})\)/);
      if (!date && year && monthDay) date = publishedDate(`${year}-${monthDay[1]}`);
      items.push({ title: text(anchor.text()), url: href, startDate: date });
    });
  });
  return [...new Map(items.map(item => [item.url, item])).values()];
}

export function parseEditorialHomepage(html) {
  const $ = load(html);
  function cards(selector) {
    const items = [];
    $(selector).each((_, element) => {
      const row = $(element), anchor = row.find('.show-title-name a').first();
      const title = text(anchor.text()), href = url(anchor.attr('href'), EDITORIAL_BASE);
      const image = url(row.find('.show-slide-item-left img').attr('src'), EDITORIAL_BASE);
      if (!title || !href || !config.editorialOrigins.includes(new URL(href).origin) || !image) return;
      const rating = text(row.find('.review-rating').text());
      items.push({ title, image, url: href, sourceName: 'Editorial', ...(Number(rating) > 0 ? { rating } : {}) });
    });
    return [...new Map(items.map(item => [item.url, item])).values()];
  }
  const trending = cards('#trending .show-slide-item');
  const popular = cards('#most_reviewed .show-slide-item'); // Source tab is labelled "most viewed".
  const titles = [...new Map([...trending, ...popular, ...cards('#most_reviewed_season .show-slide-item')].map(item => [titleKey(item.title), item])).values()];
  const reviews = [];
  $('.post-title-thumbnail a').each((_, element) => {
    const anchor = $(element), headline = text(anchor.text());
    const episode = /:\s*Episodes?\s+\d/i.test(headline);
    if (!episode && !/^\[Rate and Review\]/i.test(headline)) return;
    const name = headline.replace(/^\[Rate and Review\]\s*/i, '').replace(/:\s*Episodes?\s+.+$/i, '');
    const known = titles.find(item => titleKey(item.title) === titleKey(name));
    if (!known) return;
    const wrapper = anchor.closest('.des');
    const date = wrapper.find('time.published').attr('datetime');
    const reviewUrl = url(anchor.attr('href'), EDITORIAL_BASE);
    if (!date || !reviewUrl || !Number.isFinite(Date.parse(date))) return;
    reviews.push({ ...known, reviewUrl, date, reviewer: text(wrapper.find('.post-author a').text()), note: episode ? 'Episode recap' : 'Rate and review' });
  });
  return { trending, popular, titles, reviews: [...new Map(reviews.map(item => [item.reviewUrl, item])).values()].sort((a,b) => Date.parse(b.date) - Date.parse(a.date)) };
}
