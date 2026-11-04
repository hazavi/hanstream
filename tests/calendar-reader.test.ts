// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest';
import {parseCalendarTitles,parseFilteredShows} from '../lib/calendar-reader';
import {homepageSections,rankingLists} from '../lib/metadata-source.mjs';
const base='https://calendar.example';
afterEach(()=>vi.unstubAllEnvs());
const html='<table class="wikitable"><tr><th>Title</th><th>Channel</th><th>First Aired</th><th>Last Aired</th><th>Status</th></tr><tr><td><a href="/wiki/Starting">Starting Drama<sup>[1]</sup></a></td><td>Network</td><td>November 3</td><td>November 25</td><td>Ongoing</td></tr><tr><td><a href="/wiki/Ending">Ending Drama</a></td><td>Network</td><td>October 2</td><td>November 5</td><td>Ongoing</td></tr><tr><td><a href="/wiki/Future">Future Drama</a></td><td>Network</td><td>November 10</td><td>TBA</td><td>Awaiting release</td></tr></table>';
it('recovers weekly premieres, finales, airing and upcoming from actual published dates',()=>{
  const titles=parseCalendarTitles(html,base,2026);
  const snapshot={titles,airingUrls:[],editorial:{reviews:[],trending:[],popular:[]}};
  const home=homepageSections(snapshot,new Date('2026-11-04T12:00:00Z'));
  expect(home.starting.map((item:{title:string})=>item.title)).toEqual(['Starting Drama']);
  expect(home.ending.map((item:{title:string})=>item.title)).toEqual(['Ending Drama']);
  const ranks=rankingLists(snapshot,new Date('2026-11-04T12:00:00Z'));
  expect(ranks.airing.map((item:{title:string})=>item.title)).toEqual(['Ending Drama','Starting Drama']);
  expect(ranks.upcoming.map((item:{title:string})=>item.title)).toEqual(['Future Drama']);
});
it('accepts only same-origin filtered show links and keeps undated upcoming shows visible',()=>{
  const row=(href:string)=>`<article><figure><img src="https://pictures.example/cover.jpg"></figure><h2><a href="${href}">Announced Drama</a></h2></article>`;
  const items=parseFilteredShows(row('/shows/42/announced')+row('https://outside.example/shows/43/wrong'),base,'upcoming');
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({upcoming:true,image:'https://pictures.example/cover.jpg'});
  expect(rankingLists({titles:items,airingUrls:[],editorial:{popular:[]}},new Date('2026-11-04')).upcoming).toHaveLength(1);
});
it('preserves published calendar days in Copenhagen and rejects impossible dates',()=>{
  vi.stubEnv('TZ','Europe/Copenhagen');
  expect(parseCalendarTitles(html,base,2026)[0].startDate).toBe('2026-11-03');
  expect(parseCalendarTitles(html.replace('November 3','February 31'),base,2026)[0].startDate).toBeUndefined();
});
