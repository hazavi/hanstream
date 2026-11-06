/** Only public catalog JSON and artwork use CDN caching, never playback/library data. */
export function publicCatalogHeaders(seconds = 30) {
  return {
    "Cache-Control": `public, max-age=${seconds}, stale-while-revalidate=60`,
    "Vercel-CDN-Cache-Control": `public, s-maxage=${seconds}, stale-while-revalidate=86400`,
  };
}
