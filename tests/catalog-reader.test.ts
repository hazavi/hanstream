// @vitest-environment node
import { expect, it } from "vitest";
import { parseCatalogSearch, parseCatalogDetails, parseCatalogEpisodes, parseMediaSearch } from "../lib/catalog-reader.mjs";
import { normalizeTitle, catalogRoute } from '../lib/catalog';

const base = "https://catalog.example";
it('matches accented Latin titles while preserving Korean and Japanese letters', () => {
  expect(normalizeTitle('Bon Appétit, Your Majesty')).toBe(normalizeTitle('bon appetit your majesty'));
  expect(catalogRoute({title:'Bon Appétit, Your Majesty',year:2025})).toBe('/drama-bon-appetit-your-majesty--2025');
  expect(normalizeTitle('ガール')).not.toBe(normalizeTitle('カール'));
  expect(normalizeTitle('무빙')).toBe('무빙');
});
it("keeps release years and same-origin identities in public search results", () => {
  const row = (year: number, url = '/shows/42/fixture') => `<article><div class="showname"><a href="${url}">Fixture</a></div><span class="source"><img class="flag-align" alt="Korea, Republic of">${year} - now</span></article>`;
  expect(parseCatalogSearch(row(2026) + row(2023) + row(2026,'https://untrusted.example/shows/42/fixture'), base).map(item => item.year)).toEqual([2026, 2023]);
});
it("extracts story, poster, original title, broadcast facts, genres and ratings", () => {
  const html = '<h1>Fixture</h1><section id="general-information"><aside id="main-img"><img src="https://images.example/poster.jpg"></aside><article><p>The actual story.</p></article></section><section><h2>Show Info</h2><div><strong>Network: </strong><img class="flag-align" alt="Korea, Republic of">KBS2<span id="year">2026 - now</span></div><div><strong>Language:</strong>Korean</div><div><strong>Status:</strong>Running</div><div><strong>Genres:</strong><span class="divider"><span>Drama</span><span>Romance</span></span></div><span itemprop="ratingValue">7.2</span><span itemprop="ratingCount">14</span></section><div class="generic-info-panel"><ul><li>원제 (<img src="/kr.png">Korea)</li></ul></div><a href="/shows/42/fixture/episodeguide">Guide</a>';
  expect(parseCatalogDetails(html, base + '/shows/42/fixture')).toMatchObject({ title: 'Fixture', overview: 'The actual story.', otherNames: '원제', genres: ['Drama','Romance'], meta: { Country: 'Korea, Republic of', Released: 2026, Language: 'Korean', Rating: 7.2 }, episodesUrl: base + '/shows/42/fixture/episodeguide' });
});
it("keeps episode stills, descriptions, dates and season identity without inferring missing episodes", () => {
  const html = '<section class="episodeguide"><article><h3><a>A fresh start</a></h3><p class="info">Episode: 2x01 | Airdate: Sep 12, 2026 (45 min)</p><div class="description"><img src="https://images.example/still.jpg"><p>The episode story.</p></div></article><article><p class="info">Special: TBD</p></article></section>';
  expect(parseCatalogEpisodes(html,base)).toEqual([{ season: 2, episode: 1, title: 'A fresh start', image: 'https://images.example/still.jpg', overview: 'The episode story.', date: '2026-09-12' }]);
});
it('supports a worldwide web channel and a published Asian original-title country',()=>{
  const html='<h1>Fixture</h1><section id="general-information"><article>Story.</article></section><section><h2>Show Info</h2><div><strong>Web channel:</strong><a>Disney+</a><span id="year">2023 - now</span></div><div><strong>Language:</strong>Korean</div><div><strong>Schedule:</strong>Wednesday (~ 47 min)</div></section><div class="generic-info-panel"><ul><li>원제 (<img class="flag-align" src="https://pictures.example/kr.png" alt="Korea, Republic of">Korea)</li></ul></div>';
  expect(parseCatalogDetails(html,base+'/shows/42/fixture')).toMatchObject({country:'Korea, Republic of',meta:{Network:'Disney+',Duration:'47 min',Released:2023}});
});
it('preserves an explicitly unannounced episode air date as upcoming', () => {
  const html = '<section class="episodeguide"><article><h3><a>TBA</a></h3><p class="info">Episode: 1x08 | Airdate: TBA</p></article></section>';
  expect(parseCatalogEpisodes(html, base)).toMatchObject([{ season: 1, episode: 8, upcoming: true }]);
});
it('discards published placeholder stills instead of treating them as episode pictures', () => {
  const html='<section class="episodeguide"><article><h3><a>Episode 10</a></h3><p class="info">Episode: 1x10 | Airdate: Nov 3, 2026</p><div class="description"><img src="/images/no-img/no-img-landscape-text.png"></div></article></section>';
  const [episode] = parseCatalogEpisodes(html,base);
  expect(episode.episode).toBe(10);
  expect(episode.image).toBeUndefined();
});
it("selects a matching official publisher trailer and rejects fan uploads or a different title", () => {
  const video = (name: string, verified: boolean) => ({ videoRenderer: { videoId: 'abcdefghijk', title: { runs: [{ text: name }] }, ownerText: { runs: [{ text: 'Prime Video' }] }, ownerBadges: verified ? [{ metadataBadgeRenderer: { style: 'BADGE_STYLE_TYPE_VERIFIED' } }] : [] } });
  const html = '<script>var ytInitialData = '+JSON.stringify({ contents: [video('Fixture | Official Trailer',false),video('Fixture Again | Official Trailer',true),video('Fixture | Official Trailer',true)] })+';</script>';
  expect(parseMediaSearch(html,'Fixture')).toMatchObject({ title: 'Fixture | Official Trailer', embedUrl: 'https://www.youtube-nocookie.com/embed/abcdefghijk' });
  expect(parseMediaSearch(html,'Another Drama')).toBeNull();
});
