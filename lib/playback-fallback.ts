import 'server-only';
import { load } from 'cheerio';
import { normalizeTitle } from './catalog';
import { cleanText, httpsUrl, readHtml } from './html';
import { getSourceConfig } from './server-config.mjs';
import { createKeyedCache } from './runtime-cache';
import { availablePlayerServers } from './player-availability';
import type { PlaybackStream } from './playback';
import type { DetailRecord } from './details';

/** Public episode HTML only; executable scripts and arbitrary redirects are not read. */
export function parseFallbackEpisode(html: string, url: string, title: string, year: number, episode: string): { stream: PlaybackStream | null; detail: DetailRecord } | null {
  const $ = load(html);
  const heading = cleanText($('h1.entry-title,h1').first().text());
  const identity = /^(.*?)\s+(?:episode|ep)\s+(\d+(?:\.\d+)?)$/i.exec(heading);
  if (!identity || Number(identity[2]) !== Number(episode)) return null;
  const display = identity[1].replace(/\s*\((\d{4})\)\s*$/, '').trim();
  if (normalizeTitle(display) !== normalizeTitle(title)) return null;
  const meta: DetailRecord['meta'] = {};
  $('.spe > span').each((_, node) => {
    const row = cleanText($(node).text()), match = /^(Status|Network|Released|Duration|Country|Episodes|Casts):\s*(.+)$/i.exec(row);
    if (match) meta[match[1]] = match[2];
  });
  const publishedYear = Number(String(meta.Released || '').match(/\b(19\d{2}|20\d{2})\b/)?.[1] || /\((\d{4})\)/.exec(identity[1])?.[1]);
  if (publishedYear !== year) return null;
  const allowed = new Set((process.env.PLAYER_ORIGINS || process.env.DESKTOP_MEDIA_ORIGINS || '').split(',').map(value => value.trim()));
  const excluded = new Set(getSourceConfig().excludedPlaybackOrigins);
  const servers: PlaybackStream['servers'] = [];
  const add = (value?: string) => {
    const address = httpsUrl(value, url);
    if (!address || !allowed.has(new URL(address).origin) || excluded.has(new URL(address).origin) || servers.some(server => server.url === address)) return;
    servers.push({ name: `Server ${servers.length + 1}`, url: address });
  };
  $('#pembed iframe, .player-embed iframe, .player-embed iframe[data-src]').each((_, node) => add($(node).attr('src') || $(node).attr('data-src')));
  $('select option[value]').each((_, node) => {
    const encoded = $(node).attr('value');
    if (!encoded || encoded.length > 16_384 || !/^[A-Za-z\d+/=\s]+$/.test(encoded)) return;
    const markup = load(Buffer.from(encoded, 'base64').toString('utf8'));
    markup('iframe').each((_, frame) => add(markup(frame).attr('src')));
  });
  const description = cleanText($('.entry-content .epxt,.infox .desc,.bixbox.synp .entry-content').first().text());
  const cast = String(meta.Casts || '').split(',').map(name => ({name: name.trim()})).filter(person => person.name);
  delete meta.Casts;
  meta.Released = year;
  const detail: DetailRecord = { title: display, year, movie: false, url, image: httpsUrl($('.thumb img,.thumbook img').first().attr('src'), url) || '/file.svg', overview: description || undefined, meta, cast };
  return { detail, stream: servers.length ? { url: servers[0].url, pageUrl: url, servers } : null };
}

const lookup = createKeyedCache(async key => {
  const { title, year, episode, season } = JSON.parse(key) as {title: string; year: number; episode: string; season: number};
  const origins = getSourceConfig().playbackFallbackOrigins.slice(0, 2);
  if (season !== 1 || !year || !/^\d+(?:\.\d+)?$/.test(episode)) return null;
  const name = normalizeTitle(title).replaceAll(' ', '-');
  for (const origin of origins) for (const path of [`${name}-episode-${episode}`, `${name}-${year}-episode-${episode}`]) {
    const url = `${origin}/${path}/`;
    try {
      const result = parseFallbackEpisode(await readHtml(url, 300), url, title, year, episode);
      if (!result) continue;
      if (result.stream) {
        const servers = await availablePlayerServers(result.stream.servers);
        result.stream = servers.length ? {...result.stream, url: servers[0].url, servers} : null;
      }
      return result;
    } catch { /* Try the next exact public episode page, never an archive crawl. */ }
  }
  return null;
}, 60_000, 100, 15_000);

export const findFallbackEpisode = (title: string, year: number, episode: string, season = 1) => lookup(JSON.stringify({title, year, episode, season}));
