/** Resolve catalog paths into files GitHub Pages can serve on a fresh visit. */
export function pagesRoute(href: string): string {
  const watch = /^\/((?:drama|film)-[^/?#]+|(?:movie-)?\d+)\/episode\/([^/?#]+)\/?$/.exec(href);
  if (watch) return `/watch/?id=${encodeURIComponent(watch[1])}&episode=${encodeURIComponent(watch[2])}`;
  const detail = /^\/((?:drama|film)-[^/?#]+|(?:movie-)?\d+)\/?$/.exec(href);
  if (detail) return `/drama/?id=${encodeURIComponent(detail[1])}`;
  return href;
}
