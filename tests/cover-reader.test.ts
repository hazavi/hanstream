// @vitest-environment node
import { expect, it } from 'vitest';
import { parsePublishedCover, parsePublishedDetail } from '../lib/cover-reader';
const html = '<h1 id="firstHeading">A Thai Drama</h1><table class="infobox"><tr><td><img src="//images.example/poster.jpg"></td></tr><tr><th>Country of origin</th><td>Thailand</td></tr><tr><th>No. of episodes</th><td>10</td></tr><tr><th>Original release</th><td>7 September 2026 – present</td></tr></table>';
it('accepts a published series poster only for a matching title and release year',()=>{
  expect(parsePublishedCover(html,'A Thai Drama',2026)).toBe('https://images.example/poster.jpg');
  expect(parsePublishedCover(html,'Another Drama',2026)).toBeUndefined();
  expect(parsePublishedCover(html,'A Thai Drama',2020)).toBeUndefined();
  expect(parsePublishedCover(html.replace('Thailand','United States'),'A Thai Drama',2026)).toBeUndefined();
});
it('rejects a novel or unrelated article with the same name',()=>{
  expect(parsePublishedCover('<h1 id="firstHeading">A Thai Drama</h1><table class="infobox"><img src="https://images.example/book.jpg"><tr><th>Author</th><td>A writer</td></tr></table>','A Thai Drama')).toBeUndefined();
});
it('recovers cast roles and unambiguous portrait links from a matching alternative article',()=>{
  const page=html+'<div class="mw-parser-output"><p>A published drama synopsis that contains enough detail to describe the story and its characters in full.</p><h2><span id="Cast">Cast</span></h2><ul><li><a href="/wiki/Actor_Name_(born_1970)">Actor Name</a> as Mother</li><li>Another Actor as Father</li></ul><h2>Production</h2></div>';
  const result=parsePublishedDetail(page,'A Thai Drama','https://article.example/wiki/A_Thai_Drama',2026);
  expect(result?.cast).toEqual([{name:'Actor Name',character:'Mother',portraitKey:'article:Actor_Name_(born_1970)'},{name:'Another Actor',character:'Father',portraitKey:undefined}]);
  expect(result?.overview).toContain('published drama synopsis');
});
