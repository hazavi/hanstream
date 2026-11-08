const controlCharacters = /[\u0000-\u001f\u007f]/;
const slugPattern = /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,219}$/u;
const episodePattern = /^(?:s\d{1,3}e)?\d{1,5}(?:\.\d{1,2})?$/i;

export const validDramaSlug = (value: string) => slugPattern.test(value);
export const validEpisodeId = (value: string) => episodePattern.test(value);
export const validSearchQuery = (value: string) => value.trim().length > 0 && value.length <= 160 && !controlCharacters.test(value);

/** Reject abusive inputs before they reach public HTML readers or their caches. */
export function validateApiRequest(url: URL): string | undefined {
  if (url.pathname.length > 512 || url.search.length > 2048) return 'Request is too long';
  const query = url.searchParams;
  const seen = new Set<string>();
  for (const [key, value] of query) {
    if (seen.has(key) || controlCharacters.test(key + value)) return 'Invalid query parameters';
    seen.add(key);
  }
  if (query.has('page') && (!/^[1-9]\d{0,3}$/.test(query.get('page')!) || Number(query.get('page')) > 2000)) return 'Invalid page';
  if (query.has('year') && (!/^(?:19|20)\d{2}$|^2100$/.test(query.get('year')!))) return 'Invalid year';
  const field = url.pathname === '/api/search' ? 'q' : url.pathname === '/api/artwork' ? 'title' : url.pathname === '/api/portrait' ? 'name' : null;
  if (field) {
    const value = query.get(field)?.trim();
    if (!value || value.length > (field === 'name' ? 120 : 160)) return 'Invalid lookup';
  }
  if (query.has('key') && query.get('key')!.length > 200) return 'Invalid portrait key';
  if (query.has('secondary') && !['0', '1'].includes(query.get('secondary')!)) return 'Invalid artwork request';
  if (query.has('preview') && !['0', '1'].includes(query.get('preview')!)) return 'Invalid search mode';
  if (query.has('width') && !['80', '160', '320', '640'].includes(query.get('width')!)) return 'Invalid image size';
  if (/^\/api\/(?:drama|episode)\//.test(url.pathname)) {
    let segments: string[];
    try { segments = url.pathname.split('/').slice(3).map(decodeURIComponent); }
    catch { return 'Invalid route'; }
    if (!validDramaSlug(segments[0]) || segments.length > 2 || segments[1] && !validEpisodeId(segments[1])) return 'Invalid route';
  }
}
