import 'server-only';
import { load } from 'cheerio';
import { normalizeTitle } from './catalog';
import { readHtml, httpsUrl } from './html';
import { getSourceConfig } from './server-config.mjs';
import { createKeyedCache } from './runtime-cache';
import type { DetailRecord } from './details';
import {hasAsianOrigin} from './catalog-policy';

export function parsePublishedCover(html: string, title: string, year?: number) {
  const $ = load(html);
  const heading = $('#firstHeading,h1').first().text().replace(/\s*\((?:\d{4}\s+)?(?:(?:TV|television) series|film)\)$/i, '').trim();
  if (normalizeTitle(heading) !== normalizeTitle(title)) return undefined;
  const box = $('.infobox').first().clone(); box.find('style,script,sup').remove();
  const fields = new Map<string,string>();
  box.find('tr').each((_, element) => { const row = $(element); const label = row.children('th').text().replace(/\s+/g,' ').trim(); if (label && row.children('td').length) fields.set(label.toLowerCase(),row.children('td').text().replace(/\s+/g,' ').trim()); });
  if (![...fields.keys()].some(label => /(?:no\.|number).*episodes|original\s*release|release date/.test(label))) return undefined;
  const country = [...fields].find(([key])=>/^countr(?:y|ies)/.test(key))?.[1] || '';
  const language = [...fields].find(([key])=>/^(?:original )?languages?/.test(key))?.[1] || '';
  if (!hasAsianOrigin(country, language)) return undefined;
  const release = [...fields].filter(([key])=>/release|aired/.test(key)).map(([,value])=>value).join(' ');
  const years: string[] = release.match(/\b(?:19|20)\d{2}\b/g) || [];
  if (year && years.length && !years.includes(String(year))) return undefined;
  const picture=box.find('img').first();
  const responsive=(picture.attr('srcset')||'').split(',').map(value=>value.trim().split(/\s+/)).filter(([url,density])=>url&&/^[\d.]+[xw]$/.test(density||'')).sort((a,b)=>parseFloat(b[1])-parseFloat(a[1]));
  const image = responsive[0]?.[0] || picture.attr('src');
  return image ? httpsUrl(image, getSourceConfig().artworkOrigin || 'https://invalid.example') : undefined;
}

export function parsePublishedDetail(html: string, title: string, pageUrl: string, year?: number): DetailRecord | null {
  const image = parsePublishedCover(html, title, year);
  if (!image) return null;
  const $ = load(html);
  $('sup,script,style').remove();
  const header = $('#Cast,#Cast_and_characters').first();
  const wrapper = header.closest('.mw-heading').length ? header.closest('.mw-heading') : header.closest('h2,h3');
  const castRoot = header.closest('section').length ? header.closest('section') : wrapper.nextUntil('h2,.mw-heading2');
  const cast = castRoot.find('li').map((_,element) => {
    const row = $(element), content = row.text().replace(/\s+/g,' ').trim();
    const link = row.find('a[href*="/wiki/"]').first();
    const name = link.text().trim() || content.split(/\s+as\s+/i)[0];
    const character = content.match(/\bas\s+(.+)$/i)?.[1];
    const url = link.attr('href') ? new URL(link.attr('href')!,pageUrl) : undefined;
    const portraitKey = url?.origin === new URL(pageUrl).origin && url.pathname.startsWith('/wiki/') ? `article:${decodeURIComponent(url.pathname.slice(6))}` : undefined;
    return {name,character,portraitKey};
  }).get().filter(person=>person.name && person.name.length < 100);
  const meta: DetailRecord['meta'] = {};
  $('.infobox tr').each((_,element)=>{
    const row=$(element), label=row.children('th').text().replace(/\s+/g,' ').trim().toLowerCase();
    const value=row.children('td').text().replace(/\s+/g,' ').trim();
    const field = ({'country of origin':'Country','original language':'Language','original network':'Network','network':'Network','no. of episodes':'Episodes','number of episodes':'Episodes'} as Record<string,string>)[label];
    if(field && value) meta[field]=value;
  });
  if(year) meta.Released=year;
  const overview = $('.mw-parser-output > p, section[data-mw-section-id="0"] > p').map((_,element)=>$(element).text().replace(/\s+/g,' ').trim()).get().filter(text=>text.length>80).slice(0,2).join('\n\n');
  return {title:$('#firstHeading,h1').first().text().trim(),year,url:pageUrl,movie:false,image,cast,overview,meta};
}

export const findPublishedDetail = createKeyedCache<DetailRecord | null>(async key => {
  const {title,year}=JSON.parse(key);
  const base = getSourceConfig().artworkOrigin;
  if (!base) return null;
  const capitalized = String(title).split(' ').map(word => word ? word[0].toUpperCase() + word.slice(1) : word).join(' ');
  const natural = capitalized.replace(/\b(?:A|An|The|And|Or|Of|To|In|On|For|With|At|By)\b/g,(word,index)=>index ? word.toLowerCase() : word);
  const variants = [...new Set([title, natural, capitalized, ...(year ? [`${natural} (${year} TV series)`,`${natural} (${year} film)`] : []), `${natural} (TV series)`,`${natural} (film)`])];
  for (const variant of variants) {
    try {
      const url=`${base}/wiki/${encodeURIComponent(String(variant).replace(/ /g,'_'))}`;
      const detail = parsePublishedDetail(await readHtml(url,21600,2500),title,url,year);
      if(detail) return detail;
    } catch { /* An unpublished cover leaves the neutral placeholder in place. */ }
  }
  return null;
},21_600_000);
export async function findPublishedCover(title: string, year?: number) {
  return (await findPublishedDetail(JSON.stringify({title,year})))?.image;
}
