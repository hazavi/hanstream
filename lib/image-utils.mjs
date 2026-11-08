/** Placeholder files return HTTP 200 too, so exclude them before rendering. */
export function isPublishedImage(value) {
  if (!value || typeof value !== 'string' || value === '/file.svg') return false;
  try {
    const path = new URL(value, 'https://local.invalid').pathname;
    return path !== '/file.svg' && !/(?:^|\/)(?:no[-_]?im(?:age|g)[^/]*|no[-_]?poster[^/]*|placeholder[^/]*|blank|default[-_](?:portrait|landscape))\.(?:png|jpe?g|webp|gif|svg)$/i.test(path);
  } catch { return false; }
}

/** Prefer the catalog's original artwork, retaining its thumbnail as a fallback. */
export function posterImageSources(value) {
  if (!isPublishedImage(value)) return [];
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && /^\/uploads\/images\/medium_portrait\/\d+\/\d+\.(?:jpe?g|png|webp)$/i.test(url.pathname)) {
      url.pathname = url.pathname.replace('/medium_portrait/', '/original_untouched/');
      return [url.href, value];
    }
  } catch { /* Local artwork keeps its original path. */ }
  return [value];
}
