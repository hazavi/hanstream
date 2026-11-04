import 'server-only';
import { load } from 'cheerio';
import { readHtml } from './html';
import { normalizeTitle } from './catalog';
import { getSourceConfig } from './server-config.mjs';
import { createKeyedCache } from './runtime-cache';
import { isPublishedImage } from './image-utils.mjs';

export function parseAlbumPoster(html:string,title:string,year?:number):string|undefined {
  const $=load(html),matches=new Set<string>();let data:unknown;
  // Search cards can publish a current resized cover while the original file is gone.
  const visible=new Set<string>();
  $('.grid-card-container').each((_,element)=>{
    const row=$(element),name=row.find('a.name[href*="/album/"]').first().text();
    const released=Number(row.find('.year .val').first().text())||undefined;
    if(normalizeTitle(name)!==normalizeTitle(title)||year&&released!==year)return;
    const raw=/url\(["']?([^"')]+)["']?\)/.exec(row.find('a.img').attr('style')||'')?.[1];
    if(raw){try{const image=new URL(raw.startsWith('//')?'https:'+raw:raw);if(image.protocol==='http:')image.protocol='https:';if(image.protocol==='https:'&&isPublishedImage(image.href))visible.add(image.href);}catch{/* Ignore malformed artwork. */}}
  });
  if(visible.size===1)return [...visible][0];
  if(visible.size>1)return undefined;
  try{data=JSON.parse($('#__NEXT_DATA__').text());}catch{return undefined;}
  function visit(value:unknown){if(!value||typeof value!=='object')return;
    if(Array.isArray(value)){value.forEach(visit);return;}
    const item=value as Record<string,unknown>;
    const name=typeof(item.title||item.name)==='string'?load(String(item.title||item.name)).text():'';
    const released=Number(item.year||item.publishYear)||undefined;
    if(normalizeTitle(name)===normalizeTitle(title)&&(!year||released===year)){
      const raw=item.posterVt||item.albumPic;
      if(typeof raw==='string'){try{const url=new URL(raw.startsWith('//')?'https:'+raw:raw);if(url.protocol==='http:')url.protocol='https:';if(url.protocol==='https:'&&!url.username&&!url.password&&isPublishedImage(url.href))matches.add(url.href);}catch{/* Invalid artwork is ignored. */}}
    }
    Object.values(item).forEach(visit);
  }visit(data);return matches.size===1?[...matches][0]:undefined;
}
const lookup=createKeyedCache<string|undefined>(async key=>{
  const {title,year}=JSON.parse(key);
  for(const template of getSourceConfig().posterSearchUrls){try{const html=await readHtml(template.replaceAll('{query}',encodeURIComponent(title)),21600,3000);const image=parseAlbumPoster(html,title,year);if(image)return image;}catch{/* Try another configured public distributor catalog. */}}
  return undefined;
},21_600_000);
export function findAlbumPoster(title:string,year?:number){return lookup(JSON.stringify({title,year}));}
