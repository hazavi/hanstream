import 'server-only';
import { load } from 'cheerio';
import { normalizeTitle } from './catalog';
import { cleanText, httpsUrl, readHtml, sourceUrl, structuredItems } from './html';
import { getSourceConfig } from './server-config.mjs';
import { createKeyedCache } from './runtime-cache';
import type { DetailEpisode, DetailRecord } from './details';
import type { DramaCast } from './api-types';

const text = (value: unknown) => typeof value === 'string' ? cleanText(load(`<span>${value}</span>`)('span').text()) : '';
const slug = (value: string) => normalizeTitle(value).replaceAll(' ', '-');
const sameTitle = (a: string, b: string) => normalizeTitle(a).replaceAll(' ', '') === normalizeTitle(b).replaceAll(' ', '');
const asian = (country: string) => /Japan|Korea|China|Taiwan|Hong Kong|Thailand|Philippines|Vietnam|Indonesia|Malaysia|Singapore|India/i.test(country);
const date = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number.isFinite(Date.parse(value)) ? value : undefined;
  const time = Date.parse(`${value} UTC`);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : undefined;
};

export function parseCollectionDetail(html: string, url: string, title: string, year?: number): DetailRecord | null {
  const $ = load(html);
  const schema = structuredItems(html).find(item => item['@type'] === 'TVSeries');
  if (!schema || !sameTitle(text(schema.name), title)) return null;
  const publishedYear = Number($('[data-testid="metadata-line1"]').text().match(/\b(19\d{2}|20\d{2})\b/)?.[1]);
  if (!publishedYear || year && publishedYear !== year) return null;
  const cast: DramaCast[] = [];
  $('[data-testid="cast"] figure').each((_, element) => {
    const person = $(element), name = cleanText(person.find('a[aria-label]').first().attr('aria-label') || '');
    if (!name || /\s[•·]\s*(?:director|producer|writer|creator)\b/i.test(name) || cast.some(item => item.name === name)) return;
    const lines = person.find('figcaption').children().map((_, node) => cleanText($(node).text())).get();
    cast.push({ name, character: lines.find(line => line && line !== name), image: httpsUrl(person.find('img').attr('src'), url) });
  });
  const genres = Array.isArray(schema.genre) ? schema.genre.map(text).filter(Boolean) : [];
  const meta: DetailRecord['meta'] = { Released: publishedYear };
  if (Number(schema.numberOfEpisodes)) meta.Episodes = Number(schema.numberOfEpisodes);
  if (Number(schema.numberOfSeasons)) meta.Seasons = Number(schema.numberOfSeasons);
  if (genres.length) meta.Genre = genres.join(', ');
  if (text(schema.contentRating)) meta['Age Rating'] = text(schema.contentRating);
  if (text(schema.productionCompany)) meta.Network = text(schema.productionCompany);
  const duration = $('[data-testid="duration"]').text();
  if (duration) meta.Duration = cleanText(duration);
  return { title: text(schema.name), year: publishedYear, movie: false, url, image: httpsUrl(text(schema.image), url) || '/file.svg', overview: text(schema.description), genres, cast, meta };
}

export function parseCollectionEpisodes(html: string, url: string): DetailEpisode[] {
  const $ = load(html), episodes = new Map<string, DetailEpisode>();
  $('a[href*="/season/"][href*="/episode/"]').each((_, node) => {
    const address = sourceUrl($(node).attr('href'), url);
    const match = address && /\/season\/(\d+)\/episode\/(\d+)\/?$/.exec(new URL(address).pathname);
    if (!match) return;
    const season = Number(match[1]), episode = Number(match[2]);
    const figure = $(node).closest('figure');
    const label = $(node).attr('aria-label') || '';
    const title = cleanText(label.replace(/^.*?Season \d+\s*[•·]\s*Episode \d+\s*-\s*/i, ''));
    const paragraphs = figure.find('p').map((_, el) => cleanText($(el).text())).get();
    episodes.set(`${season}/${episode}`, { season, episode, title: title && title !== label ? title : undefined, image: httpsUrl(figure.find('img').attr('src'), url), overview: paragraphs.at(-1) });
  });
  return [...episodes.values()];
}

export function parseGuideDetail(html: string, url: string, title: string, year?: number): DetailRecord | null {
  const $ = load(html), meta: DetailRecord['meta'] = {};
  $('.list-group-item').each((_, element) => {
    const row = $(element), key = cleanText(row.children('strong').text()), value = cleanText(row.children('span').text());
    const mapped: Record<string, string> = { 'Original Country': 'Country', 'Original Language': 'Language', 'First Aired': 'Air Date', 'Average Runtime': 'Duration', Genres: 'Genre', Network: 'Network', Status: 'Status' };
    if (mapped[key] && value) meta[mapped[key]] = key === 'First Aired' ? date(value) || value : value;
  });
  const publishedYear = Number(String(meta['Air Date'] || '').slice(0, 4));
  const country = String(meta.Country || '');
  if (!asian(country) || !publishedYear || year && year !== publishedYear) return null;
  const aliases = [...$('#translations [data-title]').map((_, el) => $(el).attr('data-title') || '').get(), ...$('#translations li').map((_, el) => cleanText($(el).text())).get(), cleanText($('h1').text())].filter(Boolean);
  // A subtitle may be omitted by a catalog, but only when a verified display
  // title contains a colon and the original country and premiere year agree.
  const shortTitle = title.includes(':') ? title.split(':')[0].trim() : undefined;
  const matched = aliases.find(alias => sameTitle(alias, title)) || (year && country === 'Japan' && shortTitle ? aliases.find(alias => sameTitle(alias, shortTitle)) : undefined);
  if (!matched) return null;
  const cast: DramaCast[] = [];
  $('#people-actor a[href*="/people/"]').each((_, element) => {
    const person = $(element), label = cleanText(person.find('h2,h3').text()), parts = label.split(/\s+as\s+/i);
    if (!parts[0] || cast.some(item => item.name === parts[0])) return;
    cast.push({ name: parts[0], character: parts[1], image: httpsUrl(person.find('img').attr('data-src') || person.find('img').attr('src'), url) });
  });
  meta.Released = publishedYear;
  const english = $('#translations [data-language="eng"]').first().clone();
  english.find('h5,ul,hr').remove();
  const overview = cleanText(english.text()) || cleanText($('#translations .change_translation_text').first().find('p').text());
  return { title, year: publishedYear, country, movie: false, url, aliases, meta, overview, cast, image: httpsUrl($('img[src*="/posters/"]').first().attr('src'), url) || '/file.svg', episodesUrl: `${url.replace(/\/$/, '')}/allseasons/official` };
}

export function parseGuideEpisodes(html: string, url: string): DetailEpisode[] {
  const $ = load(html), result: DetailEpisode[] = [];
  $('.list-group-item').each((_, node) => {
    const row = $(node), match = /S(\d+)E(\d+)/i.exec(row.find('.episode-label').text());
    if (!match || Number(match[1]) < 1) return;
    const aired = date(cleanText(row.find('ul li').first().text()));
    result.push({ season: Number(match[1]), episode: Number(match[2]), title: cleanText(row.find('h4 a').text()), date: aired, upcoming: Boolean(aired && aired > new Date().toISOString().slice(0, 10)), image: httpsUrl(row.find('img').attr('data-src') || row.find('img').attr('src'), url), overview: cleanText(row.find('.list-group-item-text p').text()) });
  });
  return result;
}

const lookup = createKeyedCache<DetailRecord | null>(async key => {
  const { title, year } = JSON.parse(key) as {title: string; year?: number};
  const { collectionOrigin, guideOrigin } = getSourceConfig();
  const collection = async () => {
    if (!collectionOrigin) return null;
    for (const suffix of ['', '-1']) {
      const url = `${collectionOrigin}/show/${slug(title)}${suffix}`;
      try {
        const record = parseCollectionDetail(await readHtml(url, 21600), url, title, year);
        if (!record) continue;
        const seasonUrl = `${url}/season/1`;
        record.episodes = await readHtml(seasonUrl, 1800).then(html => parseCollectionEpisodes(html, seasonUrl)).catch(() => []);
        record.refreshPending = Boolean(Number(record.meta.Episodes) && !record.episodes.length);
        return record;
      } catch { /* Only verified matching public profiles are used. */ }
    }
    return null;
  };
  const guide = async () => {
    if (!guideOrigin) return null;
    const titles = [...new Set([title, ...(title.includes(':') ? [title.split(':')[0]] : [])])];
    for (const candidate of titles) {
      const url = `${guideOrigin}/series/${slug(candidate)}`;
      try {
        const record = parseGuideDetail(await readHtml(url, 21600), url, title, year);
        if (!record) continue;
        record.episodes = await readHtml(record.episodesUrl!, 1800).then(html => parseGuideEpisodes(html, record.episodesUrl!)).catch(() => []);
        if (record.episodes.length) metaEpisodes(record);
        else record.refreshPending = true;
        return record;
      } catch { /* A different catalog can still provide this series. */ }
    }
    return null;
  };
  return Promise.any([collection(), guide()].map(task => task.then(value => { if (value) return value; throw new Error('No matched profile'); }))).catch(() => null);
}, 3_600_000, 100, 15_000);

function metaEpisodes(record: DetailRecord) {
  record.meta.Episodes = record.episodes!.length;
  record.meta.Seasons = new Set(record.episodes!.map(item => item.season)).size;
}

export const findSupplementalDetails = (title: string, year?: number) => lookup(JSON.stringify({ title, year }));
