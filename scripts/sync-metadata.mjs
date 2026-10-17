import './load-env.mjs';
import { getSourceConfig, isSourceRedirect } from '../lib/server-config.mjs';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { collectMetadata, homepageSections, rankingLists } from '../lib/metadata-source.mjs';

const sources = getSourceConfig();
const output = new URL('../data/drama-metadata.json', import.meta.url);
let previous;
try { previous = JSON.parse(await readFile(output, 'utf8')); } catch { /* Initial catalog. */ }
async function read(address) {
  let target = new URL(address);
  for (let attempt = 0; attempt < 4; attempt++) {
    if (target.protocol !== 'https:' || !sources.allowedOrigins.includes(target.origin) || target.port || target.username || target.password) throw new Error('Invalid public source');
    const response = await fetch(target, { headers: { Accept: 'text/html', 'User-Agent': 'HanStream/0.2.0 (public HTML catalog reader)' }, redirect: 'manual', signal: AbortSignal.timeout(15000) });
    if ([301,302,303,307,308].includes(response.status)) { const next = new URL(response.headers.get('location'), target); if (!isSourceRedirect(target, next)) throw new Error('Invalid source redirect'); target = next; continue; }
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error(`Source returned ${response.status}`);
    const html = await response.text();
    if (html.length > 5_000_000 || /<title>\s*(?:Just a moment|Access denied|Attention Required)/i.test(html)) throw new Error('Source unavailable');
    return html;
  }
  throw new Error('Too many redirects');
}
const { load } = await import('cheerio');
const extraTitles = [];
try {
  const $ = load(await read(sources.streamOrigin));
  $('.post-title-link').each((_, element) => {
    const label = $(element).text().replace(/\s+/g, ' ').trim();
    const match = label.match(/^(.+?)\s*\((20\d{2})\)\s*(?:Ep\s*\d|Full)/i);
    if (match) extraTitles.push({ title: match[1], year: Number(match[2]) });
  });
} catch { /* Public metadata can still refresh if playback catalog is unavailable. */ }
const limit = Number(process.argv.find(value => value.startsWith('--limit='))?.split('=')[1]) || 180;
const snapshot = await collectMetadata(read, { previous, extraTitles, limit, onProgress: (done, total) => { if (done % 15 === 0 || done === total) console.log(`Read ${done}/${total} metadata pages`); } });
await mkdir(new URL('../data/', import.meta.url), { recursive: true });
const temporary = new URL('../data/drama-metadata.tmp.json', import.meta.url);
await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n');
await rename(temporary, output);
console.log(`Saved ${snapshot.titles.length} verified drama details.`);
console.log('Homepage:', Object.fromEntries(Object.entries(homepageSections(snapshot)).map(([key, values]) => [key, values.length])));
console.log('Sidebar:', Object.fromEntries(Object.entries(rankingLists(snapshot)).map(([key, values]) => [key, values.length])));
