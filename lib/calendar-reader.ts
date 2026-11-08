import 'server-only';
import { load } from 'cheerio';
import { readHtml, httpsUrl } from './html';
import { getSourceConfig } from './server-config.mjs';
import { createKeyedCache } from './runtime-cache';
import { normalizeTitle, type CatalogTitle } from './catalog';
import { observeReader } from './diagnostics';

export type CalendarTitle = CatalogTitle & {startDate?:string;endDate?:string;airing?:boolean;upcoming?:boolean;indexOnly:true;sourceName:string;meta:Record<string,string|number>};
const text=(value:string)=>value.replace(/\s+/g,' ').trim();
function date(value:string,year:number) {
  const match=value.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?\b/i);
  if(!match) return undefined;
  const parsed=Date.parse((/\d{4}/.test(match[0])?match[0]:`${match[0]}, ${year}`)+' 12:00:00 GMT');
  const day=Number(match[0].match(/\s(\d{1,2})/)?.[1]);
  return Number.isFinite(parsed)&&new Date(parsed).getUTCDate()===day?new Date(parsed).toISOString().slice(0,10):undefined;
}
export function parseCalendarTitles(html:string,base:string,year:number):CalendarTitle[] {
  const $=load(html),result:CalendarTitle[]=[];
  $('sup,style,script').remove();
  $('table.wikitable').each((_,table)=>{
    const rows=$(table).find('tr'),headers=rows.first().children('th,td').map((_,el)=>text($(el).text()).toLowerCase()).get();
    const titleColumn=headers.findIndex(h=>/^(title|show|series)$/.test(h));
    const startColumn=headers.findIndex(h=>/^(first aired|premiere)$/.test(h));
    const endColumn=headers.findIndex(h=>/^(last aired|finale|end date)$/.test(h));
    if(titleColumn<0 || startColumn<0&&endColumn<0) return;
    const spans=new Map<number,{left:number;value:string;href?:string}>();
    rows.slice(1).each((_,row)=>{
      const cells:{value:string;href?:string}[]=[];let col=0;
      const fill=()=>{while(spans.has(col)){const saved=spans.get(col)!;cells[col]={value:saved.value,href:saved.href};if(--saved.left<=0)spans.delete(col);col++;}};
      $(row).children('th,td').each((_,cell)=>{fill();const value=text($(cell).text()),href=$(cell).find('a[href]').first().attr('href');cells[col]={value,href};const span=Number($(cell).attr('rowspan'))||1;if(span>1)spans.set(col,{left:span-1,value,href});col++;});fill();
      const title=cells[titleColumn]?.value.replace(/\s*\(season\s+(\d+)\)/ig,' Season $1');
      if(!title || title.length>160 || title===headers[titleColumn])return;
      const startDate=date(cells[startColumn]?.value||'',year),endDate=date(cells[endColumn]?.value||'',year);
      if(!startDate&&!endDate&&!/awaiting|upcoming|announced/i.test(cells.map(c=>c.value).join(' ')))return;
      const released=Number(startDate?.slice(0,4))||year;
      result.push({title,image:'/file.svg',url:httpsUrl(cells[titleColumn]?.href,base)||base,year:released,movie:false,startDate,endDate,indexOnly:true,sourceName:'Calendar',meta:{Released:released},upcoming:/awaiting|upcoming|announced/i.test(cells.map(c=>c.value).join(' '))});
    });
  });return result;
}
export function parseFilteredShows(html:string,base:string,kind:'airing'|'upcoming'):CalendarTitle[] {
  const $=load(html);
  return $('.card h2 a[href^="/shows/"], article h2 a[href^="/shows/"]').map((_,element)=>{
    const a=$(element),url=httpsUrl(a.attr('href'),base),title=text(a.text());
    if(!url||new URL(url).origin!==new URL(base).origin||!/^\/shows\/\d+\/[^/]+$/.test(new URL(url).pathname))return null;
    return {title,url,image:httpsUrl(a.closest('.card, article').find('figure img').attr('src'),base)||'/file.svg',movie:false,indexOnly:true as const,sourceName:'Calendar',meta:{Status:kind==='airing'?'Running':'In Development'},[kind]:true};
  }).get();
}
const lookup=createKeyedCache<CalendarTitle[]>(async yearKey=>{
  const year=Number(yearKey),{artworkOrigin,catalogOrigin}=getSourceConfig();
  const records:CalendarTitle[]=[];
  const tasks: { role: 'calendar-filter'; read: ()=>Promise<CalendarTitle[]> }[]=[];
  // Start published dates before optional filter discovery and poster lookups can occupy the reader pool.
  const indexReads = artworkOrigin ? [year,year+1].map(async releaseYear => {
    try {
      const items=parseCalendarTitles(await readHtml(`${artworkOrigin}/wiki/${releaseYear}_in_South_Korean_television`,1800),artworkOrigin,releaseYear);
      records.push(...items);observeReader('calendar-index',items.length);
    } catch { observeReader('calendar-index',null); }
  }) : [];
  if(catalogOrigin){
    try{
      const $=load(await readHtml(`${catalogOrigin}/shows`,3600));
      const countries=$('select[name="Show[country_enum]"] option').filter((_,el)=>/^(Korea, Republic of|Japan|Thailand|China)$/.test($(el).text())).map((_,el)=>$(el).attr('value')!).get();
      const states=$('select[name="Show[showStatus_enum]"] option');
      const scripted=$('select[name="Show[showType_enum]"] option').filter((_,el)=>$(el).text()==='Scripted').attr('value');
      observeReader('calendar-discovery',countries.length);
      for(const kind of ['airing','upcoming'] as const){
        const status=states.filter((_,el)=>$(el).text()===(kind==='airing'?'Running':'In Development')).attr('value');
        if(!status||!scripted)continue;
        for(const country of countries)tasks.push({role:'calendar-filter',read:async()=>{const query=new URLSearchParams({'Show[country_enum]':country,'Show[showStatus_enum]':status,'Show[showType_enum]':scripted});return parseFilteredShows(await readHtml(`${catalogOrigin}/shows?${query}`,1800),catalogOrigin,kind).slice(0,8);}});
      }
    }catch{observeReader('calendar-discovery',null);}
  }
  let next=0;await Promise.all([...indexReads,...[0,1,2].map(async()=>{while(next<tasks.length){const task=tasks[next++];try{const items=await task.read();records.push(...items);observeReader(task.role,items.length);}catch{observeReader(task.role,null);}}})]);
  const unique=new Map<string,CalendarTitle>();
  for(const item of records){const key=normalizeTitle(item.title);const old=unique.get(key);unique.set(key,old?{...old,...item,year:old.year||item.year,startDate:old.startDate||item.startDate,endDate:old.endDate||item.endDate,image:item.image==='/file.svg'?old.image:item.image,meta:{...old.meta,...item.meta}}:item);}
  if(!unique.size)throw new Error('Published calendar is temporarily unavailable.');
  return [...unique.values()];
},900_000);
export function getCalendarTitles(now=new Date()){return lookup(String(Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Copenhagen',year:'numeric'}).format(now))));}
