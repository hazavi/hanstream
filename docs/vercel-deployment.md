# Vercel website and API

The website and read-only API run together on Vercel. A separate Node worker reads source pages and writes results to a Redis-compatible cache. The Vercel build excludes the source readers and their HTML/image-processing dependencies. It cannot fall back to fetching source pages directly.

## Existing reader connection

The deployed website can use the existing full Render service through an authenticated machine endpoint. Redis stays on Render's private network. This mode needs no additional public cache service.

On the reader host, keep its private source settings and `CACHE_URL`. Set `READER_GATEWAY_SECRET` to a random secret of at least 32 characters and `READER_NAMESPACE` to the same value used by Vercel. Deploy the normal `Dockerfile`, which starts queue consumers through Next.js instrumentation. Playback and metadata have separate reserved consumers; two additional consumers handle images, so failed posters cannot fill the drama/search queue. The existing website/API remain available for installed desktop builds during migration.

On Vercel, set `HANSTREAM_ROLE=web`, `READER_GATEWAY_ORIGIN` to the reader's exact public HTTPS origin without a trailing slash, the matching `READER_GATEWAY_SECRET`, and the matching `READER_NAMESPACE`. Leave `CACHE_URL` unset in this mode. Set `SITE_URL` to the public Vercel origin. Keep private source settings on the reader host, not Vercel.

The machine endpoint accepts only authenticated, size-limited jobs from the fixed reader protocol. It returns 404 without valid authentication and is disabled on Vercel. It cannot fetch arbitrary URLs. Machine responses are uncached over HTTP. Successful public metadata and image bytes use Next.js Data Cache on Vercel, plus separate bounded process caches for images and metadata. Redis credentials and reader configuration never reach the browser. The website's public API stays on Vercel.

`/api/health` on Vercel verifies the authenticated connection and reports `readerReady`. A sleeping Free reader can still delay an uncached request. Previously fetched public metadata and images remain available across cold website instances through Data Cache for up to one day. Successful public API responses also use Vercel CDN caching with background refresh. Playback URLs and search queries are excluded from durable website caching. Incomplete drama details and missing images are not persisted as successful results. The direct shared-cache option below is optional.

Artwork requests check the reader once instead of polling inside a function. Queued artwork returns a non-cacheable pending image; visible image components retry with bounded backoff. Off-screen images wait until they approach the viewport, and drama-card links do not prefetch reader work. These controls keep image traffic from multiplying metadata requests.

Vercel's [acceptable use policy](https://vercel.com/legal/acceptable-use-policy) prohibits scraping and proxy services. Keeping readers outside Vercel addresses that deployment boundary; it does not establish approval for the site's content. Source permissions and each host's policies still apply. The worker does not bypass challenges or playback restrictions.

## Optional direct shared cache

Use a Redis 7-compatible service with TCP connections, TLS, Lua, and Streams (`XREADGROUP`, `XAUTOCLAIM`, `XACK`, `XDEL`). CI uses Redis 7.4. Both Vercel and the worker need the same authenticated `rediss://` connection URL, saved as `CACHE_URL` in their secret settings.

The existing Render cache has a private address that Vercel cannot reach. Do not expose it without authentication or open its network ACL to the internet. Use a separate reachable TLS cache. Choose a region near the worker and Vercel functions, currently Frankfurt (`fra1` in `vercel.json`).

Set the same `READER_NAMESPACE` on both deployments. Use a different namespace and preferably separate credentials/cache for previews. Playback addresses have a 60-second transport TTL, are returned with `no-store`, and never enter durable browser/desktop response caches. The cache holds no personal library records.

## Dedicated worker for direct-cache mode

Create a Docker service using `Dockerfile.reader`, health path `/health`, and port `3101`. `render.reader.yaml` is an optional Free-plan blueprint for a separate Render reader. Keep the current full Render service live during setup.

Set `CACHE_URL`, `READER_NAMESPACE`, and the private source settings already used by the app. Keep every `_SOURCE_URL`, `POSTER_SEARCH_URLS`, `IMAGE_ORIGINS`, and `PLAYBACK_EXCLUDED_ORIGINS` setting on the worker. Never add them to Vercel or `NEXT_PUBLIC_` variables. The Dockerfile sets `HANSTREAM_ROLE=reader`.

The worker exposes only health endpoints. It consumes validated Redis jobs, reserves one consumer for playback, limits metadata concurrency, deduplicates requests, and warms the homepage once a minute while running. Health requires all consumers to be connected. There is no public arbitrary-URL fetch endpoint.

For local use, run `npm run build:reader` then `npm run start:reader`, supplying environment variables through your shell or host. Node does not automatically load `.env.local` for this command. A local `redis://localhost` cache is allowed only outside production.

An always-running reader is needed for consistently fast uncached playback. A Free Render web service can sleep. Cached metadata remains usable, but a fresh request can wait for startup. Optional `READER_WAKE_ORIGIN` on Vercel can point to the worker's exact HTTPS origin; a cache miss then requests its own `/health` endpoint. This is demand-driven, not scheduled keepalive traffic. The warming timer does not prevent host suspension.

## Connect Vercel

Import this repository as a Next.js project with the repository root and Node 24. `vercel.json` selects `npm run build:vercel`.

| Variable | Value |
| --- | --- |
| `HANSTREAM_ROLE` | `web` |
| `CACHE_URL` | Shared authenticated TLS cache URL |
| `READER_NAMESPACE` | Same value as the worker |
| `SITE_URL` | Final public HTTPS website origin, once assigned |
| `PLAYER_ORIGINS` | Approved public player origins, comma-separated, for the optional extension |
| `READER_WAKE_ORIGIN` | Optional exact worker HTTPS origin without a trailing slash |

The variable table above describes direct-cache mode. With the existing reader connection, use `READER_GATEWAY_ORIGIN` and `READER_GATEWAY_SECRET` instead of `CACHE_URL` and `READER_WAKE_ORIGIN`.

Leave `NEXT_PUBLIC_API_BASE_URL` unset on Vercel. The build explicitly uses same-origin `/api` requests. Desktop's exact `https://tauri.localhost` origin is already permitted. Add other real frontend origins to `FRONTEND_ORIGINS` only when needed, without wildcards.

The build succeeds without reader secrets. At runtime `/api/health` returns `503` until the cache connects. With a cache it returns `status: "ok"` and `readerReady`. Confirm `readerReady: true` before cutover. Cold requests return `202` with `Retry-After`. Individual network attempts have deadlines; an open page keeps recovering transient failures with backoff instead of stopping at an error screen. Outer retries pause in hidden/offline pages and cancel on navigation. Invalid permanent requests are not retried forever.

After the first deployment assigns a production URL, set `SITE_URL` to that origin and redeploy. Keep private preview protection enabled. Desktop should use the intended public production deployment.

## Connect desktop builds

Once the worker and Vercel deployment are healthy, run `npm run connect:backend --` followed by your real public HTTPS production origin. The command checks desktop CORS and populated homepage data, updates GitHub's `API_BASE_URL` variable, and starts the Windows desktop workflow. It does not deploy GitHub Pages. Existing installed apps retain their old API address until replaced by the new build.

Keep the old full Render service until the new website, API, and desktop build have been checked. Then retire that full service if desired; keep the separate worker running.

## Player protection and validation

Desktop filtering is built into its isolated player. Website iframe sandboxing blocks popups, new tabs, and top navigation without an extension download. Configure `PLAYER_ORIGINS` on the reader to enable bounded checks for removed uploads. See [player protection](player-protection.md).

Run `npm run check:types`, `npm run build:reader`, `npm run build:vercel`, and `node scripts/check-reader-boundary.mjs`. CI also checks Redis queue behavior, browser filtering, desktop installation, and native player isolation. `npm run build:backend` still builds the full local/Render application for rollback.
