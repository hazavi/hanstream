import 'server-only';
import { load } from 'cheerio';
import { normalizeTitle } from './catalog';
import { readHtml, httpsUrl } from './html';
import { getSourceConfig } from './server-config.mjs';

export function parsePublishedCover(html: string, title: string, year?: number) {
  const $ = load(html);
  const heading = $('#firstHeading,h1').first().text().replace(/\s*\((?:\d{4}\s+)?(?:TV|television) series\)$/i, '').trim();
  if (normalizeTitle(heading) !== normalizeTitle(title)) return undefined;
  const box = $('.infobox').first().clone(); box.find('style,script,sup').remove();
  const fields = new Map<string,string>();
  box.find('tr').each((_, element) => { const row = $(element); const label = row.children('th').text().replace(/\s+/g,' ').trim(); if (label && row.children('td').length) fields.set(label.toLowerCase(),row.children('td').text().replace(/\s+/g,' ').trim()); });
  if (![...fields.keys()].some(label => /(?:no\.|number).*episodes|original\s*release|release date/.test(label))) return undefined;
  const country = [...fields].find(([key])=>/^country/.test(key))?.[1] || '';
  if (country && !/korea|japan|china|taiwan|hong kong|thailand|philippines|singapore|malaysia|indonesia|vietnam|india/i.test(country)) return undefined;
  const release = [...fields].filter(([key])=>/release|aired/.test(key)).map(([,value])=>value).join(' ');
  const years: string[] = release.match(/\b(?:19|20)\d{2}\b/g) || [];
  if (year && years.length && !years.includes(String(year))) return undefined;
  const image = box.find('img').first().attr('src');
  return image ? httpsUrl(image, getSourceConfig().artworkOrigin || 'https://invalid.example') : undefined;
}

export async function findPublishedCover(title: string, year?: number) {
  const base = getSourceConfig().artworkOrigin;
  if (!base) return undefined;
  const capitalized = title.split(' ').map(word => word ? word[0].toUpperCase() + word.slice(1) : word).join(' ');
  const variants = [...new Set([title, capitalized, ...(year ? [`${capitalized} (${year} TV series)`] : []), `${capitalized} (TV series)`])];
  for (const variant of variants) {
    try {
      const html = await readHtml(`${base}/wiki/${encodeURIComponent(variant.replace(/ /g,'_'))}`, 21600, 4500);
      const image = parsePublishedCover(html,title,year);
      if (image) return image;
    } catch { /* An unpublished cover leaves the neutral placeholder in place. */ }
  }
  return undefined;
}
