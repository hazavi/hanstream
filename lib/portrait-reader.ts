import 'server-only';
import { load } from 'cheerio';
import { readHtml, httpsUrl, cleanText } from './html';
import { getSourceConfig } from './server-config.mjs';
import { normalizeTitle } from './catalog';
import { createKeyedCache } from './runtime-cache';
import { isPublishedImage } from './image-utils.mjs';

const nameKey = (name: string) => normalizeTitle(name.replace(/\s*\([^)]*\)/g, '')).replace(/ /g, '');
export function parsePortrait(html: string, name: string, base: string, birthYear?: number): string | undefined {
  const $ = load(html);
  const matches = new Set<string>();
  $('article h3 a[href^="/people/"]').each((_, element) => {
    if (nameKey($(element).text()) !== nameKey(name)) return;
    if (birthYear && Number($(element).closest('article').find('.year').text().match(/\d{4}/)?.[0]) !== birthYear) return;
    const image = httpsUrl($(element).closest('article').find('figure img').attr('src'), base);
    if (isPublishedImage(image)) matches.add(image!);
  });
  if (matches.size === 1) return [...matches][0];
  const heading = cleanText($('#firstHeading,h1').first().text() || $('title').text().replace(/\s*-\s*DramaWiki\s*$/, ''));
  const biography = $('.mw-parser-output #Profile, .infobox .bday').length || new URL(base).pathname.startsWith('/people/');
  if (nameKey(heading) !== nameKey(name) || !biography) return undefined;
  const image = httpsUrl($('#main-img img, .mw-parser-output .thumbimage, .infobox img').first().attr('src'), base);
  return isPublishedImage(image) ? image : undefined;
}

let active = 0;
const waiting: (() => void)[] = [];
const lookup = createKeyedCache<string | undefined>(async serialized => {
  const {name,key}=JSON.parse(serialized);
  if (active >= 4) await new Promise<void>(resolve => waiting.push(resolve)); else active++;
  try {
    const { catalogOrigin, metadataOrigin, artworkOrigin } = getSourceConfig();
    const plainName=String(name).replace(/\s*\([^)]*\)/g,'').trim();
    const birthYear=Number(String(key || '').match(/(?:^|[_ ,(])((?:19|20)\d{2})(?=[_ ,)]|$)/)?.[1]) || undefined;
    const article = plainName.replace(/\b\p{L}/gu, (letter: string) => letter.toUpperCase()).replace(/ /g, '_');
    // Read existing catalogs only, and accept an exact actor identity.
    const specific = key?.startsWith('article:') && artworkOrigin ? `${artworkOrigin}/wiki/${encodeURIComponent(key.slice(8))}` : key?.startsWith('profile:') ? `${metadataOrigin}/${encodeURIComponent(key.slice(8))}` : undefined;
    const candidates = [...new Set([specific, catalogOrigin ? `${catalogOrigin}/search?q=${encodeURIComponent(normalizeTitle(plainName))}` : undefined, `${metadataOrigin}/${encodeURIComponent(article)}`].filter((url): url is string => Boolean(url)))];
    for (const url of candidates) {
      try {
        const image = parsePortrait(await readHtml(url, 86400, 2500), name, url, url.includes('/search?') ? birthYear : undefined);
        if (image) return image;
      } catch { /* Another existing catalog may have the actor's portrait. */ }
    }
  } finally { const next = waiting.shift(); if (next) next(); else active--; }
  return undefined;
}, 86_400_000, 300);
export function findPortrait(name:string,key?:string) { return lookup(JSON.stringify({name,key})); }
