// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { findCatalogArtwork } from '../lib/catalog-details';
const read = vi.hoisted(() => vi.fn());
vi.mock('../lib/html', async importOriginal => ({ ...await importOriginal<object>(), readHtml: read }));
afterEach(() => vi.unstubAllEnvs());
it('recovers the exact Asian series poster even when the season-specific lookup fails', async () => {
  vi.stubEnv('CATALOG_SOURCE_URL', 'https://catalog.example');
  read.mockImplementation(async (url: string) => {
    if (url === 'https://catalog.example/search?q=fixture%20drama') return '<article><figure><img src="https://pictures.example/series.jpg"></figure><div class="showname"><a href="/shows/42/fixture">Fixture Drama</a></div><div class="source"><img class="flag-align" alt="Japan">2009</div></article>';
    throw new Error('Season catalog temporarily unavailable');
  });
  expect(await findCatalogArtwork(JSON.stringify({title:'Fixture Drama Season 6',year:2026}))).toBe('https://pictures.example/series.jpg');
});
