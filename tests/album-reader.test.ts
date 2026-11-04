// @vitest-environment node
import {expect,it} from 'vitest';
import {parseAlbumPoster} from '../lib/album-reader';
const page=(records:object[])=>`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{records}})}</script>`;
it('recovers exact-title distributor posters from public embedded HTML metadata',()=>{
  expect(parseAlbumPoster(page([{name:'<i>Brake</i> ONE',publishYear:'2026',albumPic:'http://pictures.example/real.jpg'}]),'Brake ONE',2026)).toBe('https://pictures.example/real.jpg');
  expect(parseAlbumPoster(page([{title:"The Forgotten Concubine's Revenge",year:'2026',posterVt:'https://pictures.example/other.jpg'}]),"The Forgotten Concubine’s Revenge",2026)).toBe('https://pictures.example/other.jpg');
});
it('rejects related shows, conflicting release years, and ambiguous poster records',()=>{
  const record={title:'A Drama',year:'2026',posterVt:'https://pictures.example/one.jpg'};
  expect(parseAlbumPoster(page([record]),'A Different Drama',2026)).toBeUndefined();
  expect(parseAlbumPoster(page([record]),'A Drama',2025)).toBeUndefined();
  expect(parseAlbumPoster(page([record,{...record,posterVt:'https://pictures.example/two.jpg'}]),'A Drama',2026)).toBeUndefined();
});
it('prefers the published search-card cover over a stale original-image URL',()=>{
  const html='<div class="grid-card-container"><a class="img" style="background-image:url(//pictures.example/current.jpg)"></a><a class="name" href="/album/a-drama-2026-id">A Drama</a><div class="year"><span class="val">2026</span></div></div>'+page([{name:'A Drama',publishYear:2026,albumPic:'https://pictures.example/deleted.jpg'}]);
  expect(parseAlbumPoster(html,'A Drama',2026)).toBe('https://pictures.example/current.jpg');
});
