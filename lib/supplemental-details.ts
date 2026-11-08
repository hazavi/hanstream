import 'server-only';
import { load } from 'cheerio';
import { normalizeTitle } from './catalog';
import { cleanText, httpsUrl, readHtml, sourceUrl, structuredItems } from './html';
import { getSourceConfig } from './server-config.mjs';
import { createKeyedCache } from './runtime-cache';
import type { DetailEpisode, DetailRecord } from './details';
import type { DramaCast } from './api-types';
import { observeReader } from './diagnostics';
import { englishText } from './display-language';
import {hasAsianOrigin, originText} from './catalog-policy';
import {resolveAsianIdentity} from './catalog-search';

const text = (value: unknown) => typeof value === 'string' ? cleanText(load(`<span>${value}</span>`)('span').text()) : '';
const slug = (value: string) => normalizeTitle(value).replaceAll(' ', '-');
const sameTitle = (a: string, b: string) => normalizeTitle(a).replaceAll(' ', '') === normalizeTitle(b).replaceAll(' ', '');
const asian = (country: string) => /Japan|Korea|China|Taiwan|Hong Kong|Thailand|Philippines|Vietnam|Indonesia|Malaysia|Singapore|India/i.test(country);
const date = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number.isFinite(Date.parse(value)) ? value : undefined;
  const time = Date.parse(`${value} UTC`);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : undefined;
};
export function parseCollectionMoviePoster(html:string,url:string,title:string,year:number):string|undefined {
  const schema=structuredItems(html).find(item=>item['@type']==='Movie');
  if(!schema||!sameTitle(text(schema.name),title)||Number(String(schema.datePublished||'').slice(0,4))!==year)return;
  const country=originText(schema.countryOfOrigin),language=originText(schema.inLanguage);
  if((country||language)&&!hasAsianOrigin(country,language))return;
  return httpsUrl(text(schema.image),url);
}
const moviePosters=createKeyedCache<string|undefined>(async key=>{
  const {title,year}=JSON.parse(key),origin=getSourceConfig().collectionOrigin;
  if(!origin||!year)return;
  const name=slug(title);
  return Promise.any([name,`${name}-${year}`].map(async name=>{
    const url=`${origin}/movie/${name}`,image=parseCollectionMoviePoster(await readHtml(url,21600),url,title,year);
    if(image)return image;throw new Error('No matching movie poster');
  })).catch(()=>undefined);
},21600000);
export const findCollectionMoviePoster=(title:string,year?:number)=>moviePosters(JSON.stringify({title,year}));
function listedImage(element: ReturnType<ReturnType<typeof load>>, base: string) {
  // Prefer the publisher's smaller rendition for 56px portraits and episode
  // cards instead of downloading its full-size image for every list entry.
  const candidates = (element.attr('srcset') || '').split(',').map(value => value.trim().split(/\s+/)).filter(([, width]) => /^\d+w$/.test(width || ''));
  const selected = candidates.filter(([, width]) => Number(width.slice(0, -1)) >= 240).sort((a, b) => Number(a[1].slice(0, -1)) - Number(b[1].slice(0, -1)))[0]?.[0];
  return httpsUrl(selected || element.attr('src'), base);
}

export function parseCollectionDetail(html: string, url: string, title: string, year?: number, identity?: Pick<DetailRecord, 'year' | 'country' | 'meta' | 'cast'>): DetailRecord | null {
  const $ = load(html);
  const schema = structuredItems(html).find(item => item['@type'] === 'TVSeries');
  if (!schema || !sameTitle(text(schema.name), title)) return null;
  const publishedYear = Number($('[data-testid="metadata-line1"]').text().match(/\b(19\d{2}|20\d{2})\b/)?.[1]);
  if (!publishedYear || year && publishedYear !== year) return null;
  const ownCountry = originText(schema.countryOfOrigin), ownLanguage = originText(schema.inLanguage);
  const corroborated = identity?.year === publishedYear ? identity : undefined;
  const actors = Array.isArray(schema.actor) ? schema.actor.map(actor => originText(actor)) : [];
  const actorKey = (name: string) => normalizeTitle(name).replaceAll(' ', '');
  const sharedCast = corroborated?.cast?.some(person => actors.some(actor => actorKey(actor) === actorKey(person.name)));
  if (!ownCountry && !ownLanguage && !sharedCast) return null;
  const country = ownCountry || corroborated?.country || String(corroborated?.meta.Country || '');
  const language = ownLanguage || String(corroborated?.meta.Language || '');
  if (!hasAsianOrigin(country, language)) return null;
  const cast: DramaCast[] = [];
  $('[data-testid="cast"] figure').each((_, element) => {
    const person = $(element), name = cleanText(person.find('a[aria-label]').first().attr('aria-label') || '');
    if (!name || /\s[•·]\s*(?:director|producer|writer|creator)\b/i.test(name) || cast.some(item => item.name === name)) return;
    const lines = person.find('figcaption').children().map((_, node) => cleanText($(node).text())).get();
    cast.push({ name, character: lines.find(line => line && line !== name), image: listedImage(person.find('img').first(), url) });
  });
  const genres = Array.isArray(schema.genre) ? schema.genre.map(text).filter(Boolean) : [];
  const meta: DetailRecord['meta'] = { Released: publishedYear };
  if (country) meta.Country = country;
  if (language) meta.Language = language;
  if (Number(schema.numberOfEpisodes)) meta.Episodes = Number(schema.numberOfEpisodes);
  if (Number(schema.numberOfSeasons)) meta.Seasons = Number(schema.numberOfSeasons);
  if (genres.length) meta.Genre = genres.join(', ');
  if (text(schema.contentRating)) meta['Age Rating'] = text(schema.contentRating);
  if (text(schema.productionCompany)) meta.Network = text(schema.productionCompany);
  const duration = $('[data-testid="duration"]').text();
  if (duration) meta.Duration = cleanText(duration);
  return { title: text(schema.name), year: publishedYear, country, movie: false, url, image: httpsUrl(text(schema.image), url) || '/file.svg', overview: text(schema.description), genres, cast, meta };
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
    episodes.set(`${season}/${episode}`, { season, episode, title: title && title !== label ? title : undefined, image: listedImage(figure.find('img').first(), url), overview: paragraphs.at(-1) });
  });
  return [...episodes.values()];
}

export function parseGuideDetail(html: string, url: string, title: string, year?: number): DetailRecord | null {
  const $ = load(html), meta: DetailRecord['meta'] = {};
  $('.list-group-item').each((_, element) => {
    const row = $(element), key = cleanText(row.children('strong').text());
    const linked = row.children('span').find('a').map((_, node) => cleanText($(node).text())).get().filter(Boolean);
    const value = key === 'Genres' && linked.length ? linked.join(', ') : cleanText(row.children('span').text());
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
  return { title: englishText($('#translations [data-language="eng"][data-title]').first().attr('data-title'), matched, title) || title, year: publishedYear, country, movie: false, url, aliases, meta, overview: englishText(overview), cast, image: httpsUrl($('img[src*="/posters/"]').first().attr('src'), url) || '/file.svg', episodesUrl: `${url.replace(/\/$/, '')}/allseasons/official` };
}

// Posters do not need a season guide, episode translations or playback lookup.
const guidePosters=createKeyedCache<string|undefined>(async key=>{
  const {title,year}=JSON.parse(key),origin=getSourceConfig().guideOrigin;
  if(!origin)return;
  const names=[...new Set([title,...(title.includes(':')?[title.split(':')[0]]:[])])];
  for(const name of names){
    const url=`${origin}/series/${slug(name)}`;
    try{
      const record=parseGuideDetail(await readHtml(url,21600),url,title,year);
      if(record?.image&&record.image!=='/file.svg')return record.image;
    }catch{/* Another independent poster catalog can still succeed. */}
  }
  // Public catalogs sometimes keep an older slug after an English title changes.
  const identity=await resolveAsianIdentity(title,year).catch(()=>null);
  for(const name of (identity?.aliases||[]).filter(name=>englishText(name)&&!names.some(old=>sameTitle(old,name))).slice(0,2)){
    const url=`${origin}/series/${slug(name)}`;
    try{const record=parseGuideDetail(await readHtml(url,21600),url,title,year);if(record?.image&&record.image!=='/file.svg')return record.image;}catch{/* Keep other poster readers available. */}
  }
},21600000,100,5000);
export const findGuidePoster=(title:string,year?:number)=>guidePosters(JSON.stringify({title,year}));

export function parseGuideEpisodes(html: string, url: string): DetailEpisode[] {
  const $ = load(html), result: DetailEpisode[] = [];
  $('.list-group-item').each((_, node) => {
    const row = $(node), match = /S(\d+)E(\d+)/i.exec(row.find('.episode-label').text());
    if (!match || Number(match[1]) < 1) return;
    const aired = date(cleanText(row.find('ul li').first().text()));
    result.push({ season: Number(match[1]), episode: Number(match[2]), title: englishText(cleanText(row.find('h4 a').text())), date: aired, upcoming: Boolean(aired && aired > new Date().toISOString().slice(0, 10)), image: httpsUrl(row.find('img').attr('data-src') || row.find('img').attr('src'), url), overview: englishText(cleanText(row.find('.list-group-item-text p').text())), detailUrl: sourceUrl(row.find('h4 a').attr('href'), url) });
  });
  return result;
}

export function parseGuideEpisodeEnglish(html: string) {
  const $ = load(html);
  const translation = $('#translations [data-language="eng"][data-title]').first();
  return {title: englishText(translation.attr('data-title')), overview: englishText(cleanText(translation.find('p').text()))};
}

const episodeEnglish = createKeyedCache(async url => {
  const value = parseGuideEpisodeEnglish(await readHtml(url, 21600));
  return value.title || value.overview ? value : null;
}, 21_600_000, 500, 60_000);

async function englishGuideEpisodes(episodes: DetailEpisode[], base: string) {
  // Individual public pages publish translations that the season index omits.
  // Bound fan-out and concurrency. Larger guides keep generic English labels
  // when no published English translation has been loaded.
  const targets = episodes.filter(ep => !ep.upcoming && (!ep.title || !ep.overview) && ep.detailUrl
    && new URL(ep.detailUrl).origin === new URL(base).origin
    && new URL(ep.detailUrl).pathname.startsWith(new URL(base).pathname.replace(/\/allseasons\/official\/?$/, '/episodes/'))).slice(0, 24);
  let index = 0;
  await Promise.all(Array.from({length: Math.min(4, targets.length)}, async () => {
    for (;;) {
      const ep = targets[index++];
      if (!ep) break;
      try {
        const translated = await episodeEnglish(ep.detailUrl!);
        ep.title = englishText(ep.title, translated?.title);
        ep.overview = englishText(ep.overview, translated?.overview);
      } catch { /* Keep dates and pictures if a translation page is unavailable. */ }
    }
  }));
  return episodes;
}

const lookup = createKeyedCache<DetailRecord | null>(async key => {
  const { title, year } = JSON.parse(key) as {title: string; year?: number};
  const { collectionOrigin, guideOrigin } = getSourceConfig();
  const collection = async () => {
    if (!collectionOrigin) return null;
    const identity = await resolveAsianIdentity(title, year).catch(() => null);
    for (const suffix of ['', '-1']) {
      const url = `${collectionOrigin}/show/${slug(title)}${suffix}`;
      try {
        const record = parseCollectionDetail(await readHtml(url, 21600), url, title, year, identity || undefined);
        if (!record) continue;
        const seasonUrl = `${url}/season/1`;
        record.episodes = await readHtml(seasonUrl, 1800).then(html => parseCollectionEpisodes(html, seasonUrl)).catch(() => []);
        record.refreshPending = Boolean(Number(record.meta.Episodes) && !record.episodes.length);
        observeReader('collection-profile', record.episodes.length);
        return record;
      } catch { /* Only verified matching public profiles are used. */ }
    }
    observeReader('collection-profile', null);
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
        record.episodes = await readHtml(record.episodesUrl!, 1800).then(html => englishGuideEpisodes(parseGuideEpisodes(html, record.episodesUrl!), record.episodesUrl!)).catch(() => []);
        if (record.episodes.length) metaEpisodes(record);
        else record.refreshPending = true;
        observeReader('guide-profile', record.episodes.length);
        return record;
      } catch { /* A different catalog can still provide this series. */ }
    }
    observeReader('guide-profile', null);
    return null;
  };
  return Promise.any([collection(), guide()].map(task => task.then(value => { if (value) return value; throw new Error('No matched profile'); }))).catch(() => null);
}, 3_600_000, 100, 15_000);

function metaEpisodes(record: DetailRecord) {
  record.meta.Episodes = record.episodes!.length;
  record.meta.Seasons = new Set(record.episodes!.map(item => item.season)).size;
}

export const findSupplementalDetails = (title: string, year?: number) => lookup(JSON.stringify({ title, year }));
