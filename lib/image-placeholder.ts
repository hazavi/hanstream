/** Distinct intrinsic sizes let image clients recognize missing/pending artwork. */
export function missingImageResponse(ttl = 60, portrait = false) {
  const drawing = portrait
    ? '<circle cx="160" cy="175" r="38"/><path d="M98 290v-24a62 62 0 0 1 124 0v24"/>'
    : '<rect x="116" y="162" width="88" height="110" rx="8"/><path d="m144 202 34 19-34 19z"/>';
  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3" viewBox="0 0 320 480"><rect width="320" height="480" fill="#151518"/><g fill="none" stroke="#96969c" stroke-width="3">${drawing}</g>${portrait ? "" : '<text x="160" y="310" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#bdbdc2">Artwork unavailable</text>'}</svg>`,
    {
      headers: {
        "Content-Type": "image/svg+xml",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": `public, max-age=${Math.min(ttl, 60)}`,
        "Vercel-CDN-Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Artwork-Available": "0",
      },
    },
  );
}
export function pendingImageResponse() {
  return new Response(
    '<svg xmlns="http://www.w3.org/2000/svg" width="3" height="2"><rect width="3" height="2" fill="#151518"/></svg>',
    {
      headers: {
        "Content-Type": "image/svg+xml",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Artwork-Pending": "1",
        "Retry-After": "2",
      },
    },
  );
}
