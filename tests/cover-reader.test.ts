// @vitest-environment node
import { expect, it } from 'vitest';
import { parsePublishedCover } from '../lib/cover-reader';
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
