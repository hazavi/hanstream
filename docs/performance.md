# Performance implementation

The static frontend now loads detail and watch screens as separate chunks. With the same Next.js production export, reported first-load JavaScript fell from 156 kB to 123 kB (about 21%). This compares build output, not a claim about every visitor's loading time.

## Measurements

Run `npm run measure:performance` against a running app. Set `PERF_SITE_URL` to the frontend and `PERF_API_URL` to its backend. Optionally set `PERF_DETAIL_PATH` to an `/api/drama/...` route and `PERF_SEARCH_QUERY` to a real title. Use `-- --http-only` to skip Chromium. `PERF_BROWSER_PATH` can select a local Chrome/Chromium executable; otherwise the script checks common Windows locations, then Playwright's installed browser.

The report separates the first API request from the next warm request. It also opens fresh mobile browser contexts with a 390 px viewport, 150 ms network latency, 200 kB/s download throughput, and 4x CPU throttling. It records LCP, first observed image load, transferred script bytes, loaded images, runtime errors, and horizontal overflow. The browser's second pass measures a warm backend with a fresh browser cache. A genuine cold-host comparison requires waiting for host idle; the script does not force a restart.

Local development measurement on 2026-11-04: homepage API first/warm requests took 14,079/926 ms; search took 7,251/115 ms. The mobile browser passes reported zero runtime errors and no horizontal overflow. Development compilation affected these numbers; they are not production benchmarks or a controlled before/after comparison. Repeat against the deployed production frontend and backend after release.

After deployment and the outbound transport repair, the same script measured homepage API requests at 4,073/42 ms and search at 878/79 ms (first/warm). Under mobile throttling, LCP was 10,460/4,032 ms, with images loaded, no runtime errors, and no horizontal overflow. These are individual samples with changing upstream data, not a controlled speedup ratio. The desktop/library validation adds about 1 kB to the post-split initial route bundle, bringing it to about 124 kB versus the original 156 kB.

Homepage and detail responses include a `Server-Timing` duration. In-process diagnostics count HTML cache hits, misses and failures, persistent cache activity, and image processing results. Counters use fixed names and contain no source URLs, titles, credentials, or request bodies.

## Optional persistent metadata cache

Set the backend-only `CACHE_URL` to a Redis-compatible connection URL using `rediss://`. Local development also permits `redis://localhost` or `redis://127.0.0.1`. Leave it empty to use existing memory caches. Keep it server-only. On Render, `RENDER=true` and an exact `CACHE_PRIVATE_HOST` permit that private hostname on port 6379 over `redis://`; this exception does not permit public plaintext caches.

Only assembled homepage data and complete drama metadata are stored. Keys are hashes, isolated by source configuration, with a one-day maximum lifetime and a 2 MB record cap. Fresh records avoid source reads after a restart; stale records return immediately while one refresh runs. Failed refreshes keep the saved record. Playback responses and expiring stream URLs are excluded. Connections and commands have short deadlines; an unavailable store falls back to live readers.

The deployed backend now uses a Free Render Key Value instance (Valkey) in the same workspace and Frankfurt region. External cache access is disabled. Successful catalog data can survive a backend restart or redeploy, but the Free cache loses its contents if the cache itself restarts. Local SQLite remains the desktop library store. See [Render Key Value](https://render.com/docs/key-value).

Completed homepage results that arrive after the response budget are also saved to the shared cache. Partial snapshots never replace its last complete record. The cache was initialized from current verified source HTML, with no catalog JSON committed to the repository.

The Redis command queue is capped at 32, with at most 16 active commands per connection and a two-second command budget. One slow command does not disconnect healthy users or disable the cache for a minute. Three consecutive timeouts reset a stalled connection; reconnect attempts wait one second. Initial connections have a three-second budget.

The outbound dispatcher uses Undici 7 to match Node 24's built-in fetch API. A real local HTTP regression test covers that integration; mocking fetch alone would miss an incompatible dispatcher major version.

Server HTML readers use the HTTP client's own fetch implementation rather than Next's patched global fetch. Both HTTP paths have a real local-server regression check. Homepage sections resolve independently and retain previous successful sections during an outage. A usable partial homepage has a short public cache lifetime; an empty homepage is not cached. A failed optional metadata lookup no longer discards available episodes. The regular homepage reuses the same assembled snapshot as the desktop API.

## Optional image byte cache

Set backend-only `IMAGE_ORIGINS` to a comma-separated list of exact HTTPS image CDN origins. Only server-discovered artwork and portrait URLs on that list can be resized. A miss or failed approved download returns a neutral image with a 60-second cache lifetime; it does not redirect the browser to a stalled host.

The existing artwork and portrait routes accept `width=80`, `160`, `320`, or `640`. The pipeline accepts JPEG, PNG, WebP, and AVIF, limits input to 5 MB and 25 million decoded pixels, emits WebP, caps active jobs at four, and retains at most 24 MB of image bytes in memory. It supplies ETags and conditional 304 responses. Every redirect is checked against the origin list. DNS resolution is bound to the connection and rejects non-public addresses. Upstream SVG is excluded. The server-generated fallback SVG contains no upstream content.

This cache covers image requests through those backend routes, not every direct image URL returned by a catalog. Reader-side image processing has a bounded process cache. The Vercel website also saves successful metadata and image responses in Next.js Data Cache, serves stale successes while refreshing, and caches public responses at its CDN. Missing images and transport failures do not replace saved successful images. Expiring playback addresses and search queries stay out of durable website caching. No image files or generated catalogs are committed.

## Local client storage

The desktop uses SQLite for its library and bounded catalog cache. Browser libraries use localStorage and browser catalog responses use IndexedDB. Complete catalog/detail responses can be reused during a short outage; incomplete results and playback URLs are not persisted. Disk operations run asynchronously, and cache failures fall through to the network. Browser records are limited to 50 entries and 10 MB; desktop cache records to 100 entries and 20 MB. Catalog records can remain available for up to one day while refreshing in the background.

The 1.0.1 desktop patch publishes background refreshes to open views, preserves known homepage sections through independent reader failures, and handles a waking Free backend with a shared bounded health check. Cache reads have a 300 ms budget so a slow local database does not block the network. Canonical playback lookup runs independently of optional drama details. Episode requests do not start archive crawls; explicit archive scans are capped at eight pages. Reader timeouts pause the failed page, while explicit 403/429 responses still pause the origin. Empty metadata is retried instead of being cached for six hours.
