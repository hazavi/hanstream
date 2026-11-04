/** Placeholder files return HTTP 200 too, so exclude them before rendering. */
export function isPublishedImage(value) {
  if (!value || typeof value !== 'string' || value === '/file.svg') return false;
  try {
    const path = new URL(value, 'https://local.invalid').pathname;
    return path !== '/file.svg' && !/(?:^|\/)(?:no[-_]?im(?:age|g)[^/]*|no[-_]?poster[^/]*|placeholder[^/]*|blank|default[-_](?:portrait|landscape))\.(?:png|jpe?g|webp|gif|svg)$/i.test(path);
  } catch { return false; }
}
