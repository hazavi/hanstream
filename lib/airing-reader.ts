import 'server-only';
import {load} from 'cheerio';
import {getSourceConfig} from './server-config.mjs';
import {readCatalogHtml,getCatalogProfile} from './catalog-search';
import {createKeyedCache} from './runtime-cache';
import {persistentLoader} from './persistent-cache';
import {type CatalogTitle} from './catalog';
import {parseCatalogBrowse} from './catalog-reader.mjs';
import type {DetailRecord} from './details';
import {hasAsianOrigin} from './catalog-policy';

type AiringProfile=DetailRecord&{premiereDate?:string;nextAirDate?:string;latestAirDate?:string;nextSeason?:number;latestSeason?:number;nextEpisode?:number};
export function isAiringProfile(record:AiringProfile,today:string) {
  const next=record.nextAirDate,last=record.latestAirDate;
  if(!hasAsianOrigin(record.country,record.meta.Language)||record.meta['Show Type']!=='Scripted'||!next||!/^\d{4}-\d{2}-\d{2}$/.test(next)||!Number.isFinite(Date.parse(next))||next<today)return false;
  if(Date.parse(next)-Date.parse(today)>14*86400000)return false;
  if(record.nextEpisode===1&&next>today)return false;
  return record.nextEpisode===1&&next===today||Boolean(last&&/^\d{4}-\d{2}-\d{2}$/.test(last)&&Number.isFinite(Date.parse(last))&&last<=today&&Date.parse(today)-Date.parse(last)<=21*86400000&&record.latestSeason===record.nextSeason);
}
const assemble=persistentLoader<AiringProfile[]>('airing-profiles-v2',async today=>{
  const origin=getSourceConfig().catalogOrigin;
  if(!origin)throw new Error('The published catalog is unavailable.');
  const $=load(await readCatalogHtml(`${origin}/shows`));
  const options=(name:string)=>Object.fromEntries($(`select[name="Show[${name}]"] option[value]`).map((_,el)=>({label:$(el).text().trim(),value:$(el).attr('value')!})).get().map(item=>[item.label,item.value]));
  const languages=options('language_enum'),type=options('showType_enum').Scripted,sort=options('sort')['Most popular'];
  if(!type||!sort)throw new Error('Published drama filters are unavailable.');
  const lists=await Promise.all(['Korean','Japanese','Chinese','Thai'].map(async language=>{
    if(!languages[language])throw new Error('Published language filter is unavailable.');
    const filters={'Show[language_enum]':languages[language],'Show[showType_enum]':type,'Show[premiereFrom]':String(Number(today.slice(0,4))-1),'Show[sort]':sort};
    return parseCatalogBrowse(await readCatalogHtml(`${origin}/shows?${new URLSearchParams(filters)}`),origin,filters).items as CatalogTitle[];
  }));
  const titles=[...new Map(lists.flat().map(item=>[item.url,item])).values()];
  // Previous and next episode dates also cover global streaming channels.
  const profiles=await Promise.all(titles.map(item=>getCatalogProfile(item.url)));
  return profiles;
},value=>Array.isArray(value)&&value.length>0,900000);
const profiles=createKeyedCache<AiringProfile[]>(today=>assemble(today),900000);
const day=(now:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Copenhagen',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const title=(record:AiringProfile):CatalogTitle=>({title:record.title,url:record.url,image:record.image,year:record.year,movie:false});
export async function getAiringDramas(now=new Date()) {
  const today=day(now);
  return (await profiles(today)).filter(record=>isAiringProfile(record,today)).map(title).sort((a,b)=>a.title.localeCompare(b.title,'en'));
}
export async function getCatalogWeek(now=new Date()) {
  const today=day(now),monday=new Date(today+'T12:00:00Z');
  monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
  const start=monday.toISOString().slice(0,10);
  const end=new Date(monday.getTime()+7*86400000).toISOString().slice(0,10);
  const items=await profiles(today);
  const rows=(field:'premiereDate'|'latestAirDate')=>items
    .filter(item=>Boolean(item[field] && item[field]! >= start && item[field]! < end &&
      (field==='premiereDate'||item.meta.Status==='Ended'&&!item.nextAirDate)))
    .map(item=>({...title(item),date:item[field],note:new Date(item[field]!+'T12:00:00Z')
      .toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Copenhagen'})}))
    .sort((a,b)=>a.date!.localeCompare(b.date!)||a.title.localeCompare(b.title));
  return {starting:rows('premiereDate'),ending:rows('latestAirDate')};
}
