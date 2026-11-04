// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { parsePortrait, findPortrait } from '../lib/portrait-reader';
const read=vi.hoisted(()=>vi.fn());
vi.mock('../lib/html',async original=>({...await original<object>(),readHtml:read}));
afterEach(()=>vi.unstubAllEnvs());
it('accepts the exact person and ignores another actor or a placeholder portrait', () => {
  const row = (name: string, image: string) => `<article><figure><img src="${image}"></figure><h3><a href="/people/42/person">${name}</a></h3></article>`;
  const html = row('Another Person', 'https://pictures.example/wrong.jpg') + row('Chae Soo Bin', 'https://pictures.example/correct.jpg');
  expect(parsePortrait(html, 'Chae Soo Bin', 'https://catalog.example')).toBe('https://pictures.example/correct.jpg');
  expect(parsePortrait(row('Chae Soo Bin', '/images/no-img/no-img-portrait-text.png'), 'Chae Soo Bin', 'https://catalog.example')).toBeUndefined();
});
it('recovers a public profile photo when a character photo is unpublished', () => {
  const html = '<title>Kim Young Kwang - DramaWiki</title><div class="mw-parser-output"><h2><span id="Profile">Profile</span></h2><img class="thumbimage" src="/portrait.jpg"></div>';
  expect(parsePortrait(html, 'Kim Young Kwang', 'https://metadata.example')).toBe('https://metadata.example/portrait.jpg');
  expect(parsePortrait(html, 'Kim Young Jin', 'https://metadata.example')).toBeUndefined();
});
it('uses the published birth year to distinguish actors sharing a name',()=>{
  const row=(year:number)=>`<article><figure><img src="https://pictures.example/${year}.jpg"></figure><h3><a href="/people/${year}/actor">Kim Hee Jung</a><span class="year">(${year})</span></h3></article>`;
  expect(parsePortrait(row(1992)+row(1970),'Kim Hee Jung','https://catalog.example',1970)).toBe('https://pictures.example/1970.jpg');
  expect(parsePortrait(row(1992)+row(1970),'Kim Hee Jung','https://catalog.example')).toBeUndefined();
});
it('normalizes hyphenated actor names for public search without relaxing identity matching',async()=>{
  vi.stubEnv('CATALOG_SOURCE_URL','https://catalog.example');
  read.mockImplementation(async(url:string)=>url==='https://catalog.example/search?q=jung%20jae%20kwang'?'<article><figure><img src="https://pictures.example/actor.jpg"></figure><h3><a href="/people/42/actor">Jung Jae Kwang</a></h3></article>':'');
  expect(await findPortrait('Jung Jae-kwang')).toBe('https://pictures.example/actor.jpg');
});
