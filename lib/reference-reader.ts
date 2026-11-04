import 'server-only';
import { load } from 'cheerio';
import { cleanText, httpsUrl, readHtml } from './html';
import { normalizeTitle } from './catalog';
import { createKeyedCache } from './runtime-cache';
import { getSourceConfig } from './server-config.mjs';
import type { DetailRecord } from './details';

export function parseReferenceDetail(html: string, url: string, query: string, year?: number): DetailRecord | null {
  const $ = load(html);
  const title = cleanText($('.tbs-detail-title-txt em').first().text());
  if (!title || normalizeTitle(title) !== normalizeTitle(query)) return null;
  const fields = new Map<string, ReturnType<typeof $>>();
  $('.tv_program_label').each((_, element) => { fields.set(cleanText($(element).text()), $(element).next()); });
  const period = cleanText(fields.get('Broadcast Date')?.text() || '');
  const released = Number(period.match(/\b(?:19|20)\d{2}\b/)?.[0]) || undefined;
  if (year && released !== year) return null;
  const original = cleanText($('.tbs-detail-title-txt span').first().text()).split(/\s{2,}|[\u3000\n]/)[0];
  const cast = fields.get('Cast')?.find('a').map((_, element) => ({ name: cleanText($(element).text()) })).get() || [];
  const genres = fields.get('GENRE')?.find('li').map((_, element) => cleanText($(element).text())).get() || [];
  // The first paragraph ends at the language separator; translated copies follow it.
  const overview = cleanText(load(($('.desc').first().html() || '').split(/<hr\b/i)[0]).text());
  const meta: DetailRecord['meta'] = {};
  if (released) meta.Released = released;
  if (period) meta['Broadcast period'] = period;
  const writer = cleanText(fields.get('Scenario Writer')?.text() || '');
  if (writer) meta.Writer = writer;
  if (genres.length) meta.Genre = genres.join(', ');
  if (cast.length) meta.Cast = cast.map(person => person.name).join(', ');
  return { title, year: released, url, movie: false, meta, overview, cast, genres, tags: genres, otherNames: original || undefined,
    image: httpsUrl($('.tv_program_image img').first().attr('src') || $('meta[property="og:image"]').attr('content'), url) || '/file.svg' };
}

const lookup = createKeyedCache<DetailRecord | null>(async key => {
  const { title, year } = JSON.parse(key);
  const base = getSourceConfig().referenceOrigin;
  if (!base) return null;
  const path = normalizeTitle(title).replace(/ /g, '');
  try {
    const url = `${base}/en/program/${encodeURIComponent(path)}`;
    return parseReferenceDetail(await readHtml(url, 21600, 4500), url, title, year);
  } catch { return null; }
});
export function findReferenceDetail(title: string, year?: number) { return lookup(JSON.stringify({ title: normalizeTitle(title), year })); }
