import { BackendRequestError } from './request-retry';

const maxBytes = 2_000_000;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const rows = (value: unknown, limit = 2000) => Array.isArray(value) && value.length <= limit && value.every(record);
const strings = (value: unknown) => Array.isArray(value) && value.length <= 1000 && value.every(item => typeof item === 'string');
const optionalText = (value: unknown) => value === undefined || typeof value === 'string';
function catalogRows(value: unknown) {
  return rows(value) && (value as Record<string, unknown>[]).every(item => typeof item.title === 'string' && ['image', 'detail-link', 'episode-link', 'id', 'url', 'note', 'date'].every(key => optionalText(item[key])));
}

/** Validate stored and network data before a malformed response can enter a page. */
export function validCatalogResponse(path: string, value: unknown): boolean {
  if (!record(value)) return false;
  const pathname = new URL(path, 'https://cache.invalid').pathname;
  if (pathname.startsWith('/api/drama/')) {
    const detail = value.result;
    return record(detail)
      && (detail.title === undefined || typeof detail.title === 'string')
      && (detail.description === undefined || typeof detail.description === 'string')
      && optionalText(detail.image) && optionalText(detail.other_names)
      && (detail.meta === undefined || record(detail.meta))
      && (detail.episodes === undefined || rows(detail.episodes, 10_000) && (detail.episodes as Record<string, unknown>[]).every(item => typeof item.episode === 'number' && Number.isFinite(item.episode) && item.episode > 0 && typeof item.episode_link === 'string' && ['title', 'image', 'release_date', 'description'].every(key => optionalText(item[key]))))
      && (detail.cast === undefined || rows(detail.cast, 1000) && (detail.cast as Record<string, unknown>[]).every(item => typeof item.name === 'string' && ['character', 'image', 'portraitKey'].every(key => optionalText(item[key]))))
      && (detail.tags === undefined || strings(detail.tags))
      && (detail.genres === undefined || strings(detail.genres))
      && (detail.poster_fallbacks === undefined || strings(detail.poster_fallbacks));
  }
  if (pathname === '/api/home') {
    if (!catalogRows(value.recent) || !catalogRows(value.popular) || !record(value.home) || !record(value.rankings)) return false;
    const home = value.home, lists = value.rankings.lists;
    return ['reviews', 'trending', 'starting', 'ending'].every(key => home[key] === undefined || catalogRows(home[key])) && record(lists) && ['airing', 'upcoming', 'popular'].every(key => lists[key] === undefined || catalogRows(lists[key]));
  }
  if (pathname === '/api/catalog') return catalogRows(value.items);
  if (pathname === '/api/search') return catalogRows(value.results);
  return true;
}

/** A streaming cap also protects against an absent or dishonest Content-Length. */
export async function readCatalogJson(response: Response): Promise<unknown> {
  const oversized = () => new BackendRequestError('The catalog response exceeded its size limit.', false);
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw oversized();
  }
  if (!response.body) throw new BackendRequestError('The catalog returned an empty response.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  const chunks: string[] = [];
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw oversized(); }
      chunks.push(decoder.decode(value, {stream: true}));
    }
    chunks.push(decoder.decode());
  } finally { reader.releaseLock(); }
  try { return JSON.parse(chunks.join('')); }
  catch { throw new BackendRequestError('The catalog returned an invalid response.'); }
}
