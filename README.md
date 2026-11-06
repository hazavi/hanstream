# HanStream

Deployment target: [Vercel website and API with a separate source worker](docs/vercel-deployment.md). The repository includes an isolated Vercel build, worker Dockerfile, validated Redis queue, and desktop/browser player protection. The existing Render reader connects through an authenticated machine endpoint with its cache on the private network. A direct shared TLS cache is an optional alternative.

Website: [HanStream on Render](https://hanstream-backend.onrender.com/). Render serves the full website and its same-origin catalog readers. GitHub Pages deployment is retired.

An Asian drama app with episode playback, a browser-local watchlist, ratings, and viewing progress. The interface uses black, white, and neutral gray, with outlined navigation, sliding selectors, and flat panels in light and dark mode. Drama artwork and video retain their original colors.

## Develop

```bash
npm install
# Copy .env.example to .env.local and set the private source origins.
npm run dev
```

The default development command uses Webpack with its own clean `.next-dev-webpack` cache to avoid the Next 15.5 Turbopack debug-frame decoder failure (`frame.join`). `npm run dev:turbo` remains available for explicit experiments and uses a separate cache. Reusable shadcn primitives and the supplied bookmark-tabs demo live in `components/ui`; application components stay in `components`, with shared styles in `app/globals.css` and the `cn` helper in `lib/utils.ts`. `components.json` records these aliases for the shadcn CLI.

Use `npm run dev` for development, including `npm run dev -- --port 3000` when specifying a port. Its launcher permits one dev server per checkout so two Next processes cannot overwrite the same vendor chunks. Stop the existing terminal with Ctrl+C before restarting. The ignored runtime lock is released on exit and recovered after a terminated launcher. The server HTML parser and transport load as native Node dependencies instead of generated vendor chunks. Production builds keep their separate `.next` output.

Source configuration lives in the ignored .env.local file. Set STREAM_SOURCE_URL, METADATA_SOURCE_URL, EDITORIAL_SOURCE_URL, and DETAILS_SOURCE_URL to HTTPS origins. CATALOG_SOURCE_URL enables the additional public show and episode guide reader; MEDIA_SOURCE_URL enables official trailer discovery from public search HTML. These reader settings are already configured in this checkout's ignored local environment and must also be copied to the backend host before deploying this update. No API keys are required. The app's own routes expose only the data needed for browsing and playback. Catalogs are fetched at runtime and cached inside the backend process. No metadata or playback data files are included in the repository or deployment image.

The source readers are marked server-only. Never prefix these variables with NEXT_PUBLIC_ or add them to next.config.env. On deployment, set the variables in the hosting service's private server environment.

Environment variables keep source configuration out of the client bundle. The browser still receives the final player URL and displayed images and metadata because it needs them to render the app.

The homepage includes latest episodes, popular dramas, reviews, weekly trends, premieres, and finales. Cards open internal drama pages. Source labels and outbound navigation are omitted from the interface; playback servers use numbered controls.

Drama pages share the same layout on the website and desktop app. The primary detail reader supplies summaries, original titles, genres, tags, ratings, broadcast facts, trailers, and episode cards with names and stills when published. Unavailable posters fall back to matching artwork from the other configured catalogs. Show info, cast, and trailer share left-aligned outline tabs inside a bordered panel below the poster and summary, with Show info selected first; cast pages show six people, and actor portraits load only for the current page using the existing catalogs. The trailer tab is omitted when no trailer is available. Upcoming episodes remain visible without a playback link and keep their full episode number. Released episodes without a published still use the show poster. Missing or blocked detail pages use available fallback metadata and verified playback entries.

The shared `components/ui/slide-tabs.tsx` component accepts typed items, a selected value, a change handler, and navigation or panel mode. It supplies route links for the header and keyboard-controlled panel buttons for drama details. The header is one compact pill with Home, Popular, Latest, Movies, search, library, and theme controls. It stays in document flow and scrolls away. Search opens a popover, with Ctrl/Cmd+K and Escape support. Tab geometry is cached between resizes, and resizing preserves the hovered target. The cursor uses a 180 ms eased transition, with reduced-motion support. `components/ui/demo.tsx` includes the supplied selector demo. Shared application styles stay in `app/globals.css`; the outline theme and responsive navigation rules are in `app/outline.css`. Real drama artwork remains in use; this interface needs no stock images.

## Runtime catalog data

The backend reads current HTML pages after startup. Drama details use title-specific searches and public episode guides, without waiting for the homepage catalog or archive index. Standard episode routes are accepted only after their page title confirms the requested title, year and episode. Nonstandard routes can trigger a background index with two workers; the player waits at most 1.5 seconds for that index in a request. The latest homepage does not start an archive crawl. Lists wait at most one second for missing artwork enrichment, then render while cached image recovery continues in the background. Archived catalog and broad playback-search requests can still require a full index.

The watch page uses a responsive player and episode sidebar with pictures, descriptions, season selection, exact-number or title search, and sorting in a compact list. Large episode lists mount at most 50 cards per range. Successful browser data requests are reused for 30 seconds; complete drama details are reused for five minutes. Expired good results stay visible while one shared refresh runs. Aborting one page does not cancel a shared request needed by another page. Incomplete details expire after 15 seconds and get one automatic recovery request on both hosting modes. A temporary gateway response is retried once. Playback addresses are not served from the longer stale cache.

The server also caches assembled drama responses by title, shares concurrent loads, and keeps known summaries, posters, cast, and episode lists when a source returns partial data. Independent detail fallbacks start in parallel. Optional cast enrichment waits at most 1.2 seconds when a summary is already available, and detail poster discovery waits at most 500 ms before continuing through the image endpoint. Browser artwork instances share working image candidates, skip recent failures, and make one delayed recovery attempt per candidate set per minute. Image miss responses are not HTTP-cached; successful image redirects remain cacheable. These caches are bounded and contain runtime data only.

The process keeps live results in memory and refreshes them periodically. If a refresh fails, it keeps the data already fetched by that process. HTML requests share a bounded in-memory cache, time out within 3.5 seconds, and cool down an unreachable host for one minute. Previous valid HTML remains available during an outage. Image endpoints cap each request at 5.5 seconds, while background lookup results can be reused later. An unavailable metadata host does not discard accessible editorial listings, and the existing artwork catalog can also recover published cast details. A cold backend needs at least one relevant source page to be available. Restarting clears these in-memory catalogs. The ignored `data/` directory is excluded from Docker builds.

The homepage API shares a successful snapshot for 30 seconds and refreshes it in the background. All homepage sections share one artwork worker pool. HTML reads cap concurrent uncached requests and cancel response bodies above 5 MB before buffering the entire page. See [security controls and deployment limits](docs/security.md) for request validation, browser policies, iframe isolation, and dependency checks.

Weekly lists use published dates and Monday to Sunday in Europe/Copenhagen. No finale is inferred from an episode count. Title matching includes the release year so different remakes are kept separate.

## Validate and build

```bash
npm test -- --run
npm run build
npm start
```

Personal watch data stays in the browser's local storage. Readable drama routes include the title and release year, and existing numeric routes remain supported.

## Existing Render website

The existing Free Docker service hosts the full application. Keep private source origins in Render environment variables. See the [deployment guide](docs/deployment.md). The desktop app packages its own frontend and uses the public Render origin for catalog requests.

See [performance, security, and desktop app suggestions](docs/improvement-suggestions.md) for implementation status, verification results, and remaining configuration.

Implemented work is documented in [performance](docs/performance.md), [security operations](docs/security-operations.md), and [Windows desktop setup](docs/desktop.md). Run `npm run desktop:dev` or `npm run desktop:build -- --locked` after configuring the public desktop backend URL and native prerequisites.

The optional private ARTWORK_SOURCE_URL enables a published-series-cover fallback for missing posters. Copy its value from the ignored local environment into your backend environment before deploying.

The optional private REFERENCE_SOURCE_URL enables the public broadcaster catalog fallback for matching titles, including cast and summaries. Copy its value from the ignored local environment to the backend host.

Manual watched buttons are omitted from episode cards and playback controls. Existing watched history stays in the local profile, and resume history is updated only when a player is available. Opening a page never marks an episode completed.

Airing, upcoming, and weekly premiere/finale lists can use published HTML calendar dates and filtered scripted-show catalogs when the primary metadata index is unavailable. Dates are not inferred from episode counts.

For the additional official-distributor poster fallback, copy `POSTER_SEARCH_URLS` from the ignored local environment to the backend host. It contains comma-separated public HTML search URL templates with `{query}`. Keep this server-only.

Windows installer: [Download HanStream v1.0.2](https://github.com/hazavi/hanstream/releases/download/v1.0.2/HanStream_1.0.2_x64-setup.exe). The installer asks for a folder, offers an optional desktop shortcut, and includes an uninstaller. This release is unsigned; automatic signed updates remain disabled.
