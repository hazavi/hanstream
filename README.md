# HanStream

An Asian drama browser and player for the web and Windows. The interface includes search, drama details, cast, trailers, episode navigation, a personal library and playback history.

[Open the website](https://hanstream-phi.vercel.app) · [Download the latest Windows release](https://github.com/hazavi/hanstream/releases/latest)

## Web and desktop

The website and public API run on Vercel. A separate reader service reads configured public HTML catalogs and supplies metadata and playback addresses. The Vercel build excludes source readers and their HTML-processing dependencies. Source settings stay in the reader's private environment; no catalog snapshots are committed to the repository.

Both clients share the interface and recovery logic. Complete metadata is cached locally, and known content remains visible during temporary outages. Large drama pages show 24 episodes per page; the watch sidebar shows up to 50 per range. Cast pages show six people. Images load near the viewport and use matching poster fallbacks when available.

Personal library data stays on the device. The website uses browser storage; Windows uses SQLite. Search queries and expiring playback responses are excluded from persistent content caches. Library export and import are available on the profile page.

Popular has all-time and recent rankings. Ongoing dramas and Korean variety shows have separate paginated pages. Browse filters are read from the public catalog, and search checks the full catalog rather than only the homepage. Shared-title metadata requires Asian country or language evidence. Watchlist folders show 20 dramas per page.

The homepage's popular section uses the recent popular category. Its airing sidebar and ongoing page share one cached catalog list, checked against published previous and next episode dates. A renewed series waiting for a later season is excluded. Ranking refreshes keep a complete snapshot when an upstream market fails, instead of switching to another provider. Catalog pages use six columns on wide screens.

Windows exports always open a native Save As dialog. Browsers use a save-location picker when supported; otherwise their download settings control the location. Cancelled exports do not change the library. Launching the Windows app again restores and focuses its existing window instead of starting another instance. The Windows icon uses the same favicon as the website.

The Windows player runs in a separate native WebView with no library access. Built-in filtering blocks known advertising hosts. Desktop and web players block popups, new tabs, downloads and top-level redirects. Independent players may still be unavailable or reject embedding.

## Windows installation

Download the installer from the latest GitHub release. It lets you choose an installation folder and an optional desktop shortcut, and includes an uninstaller. The portable executable needs an installed Microsoft Edge WebView2 runtime.

Upgrades from older versions replace the app and its uninstaller in place, without running the previous uninstaller. The local library is preserved. After updating, use Windows Settings or `uninstall.exe` in the installation folder to remove the app.

Current Windows releases are unsigned. SHA-256 checksums are provided with release assets. Signed automatic updates remain disabled until code-signing and updater credentials are configured; install a new release manually to update the bundled interface. Server metadata fixes apply without replacing the app.

## Development

Use Node.js 24 and npm. Copy `.env.example` to the ignored `.env.local` and configure the variables for the role being run.

```sh
npm ci
npm run dev
```

The default development server uses a separate Webpack cache and permits one dev server per checkout. `npm run dev:turbo` is available for explicit Turbopack testing. Production builds use their own output directory.

Application components live in `components`, shared UI primitives in `components/ui`, and styles in `app/globals.css` and `app/outline.css`. TypeScript aliases and shadcn configuration are already set up.

## Builds and checks

```sh
npm run check:types
npm run check:secrets
npm audit
npm run build:vercel
node scripts/check-reader-boundary.mjs
npm run build:reader
```

The reader requires its private source and cache configuration at runtime. The website requires its authenticated reader connection. Consult `.env.example` for the available settings. Never prefix reader credentials or source settings with `NEXT_PUBLIC_`. Browsers receive the final displayed metadata, image addresses and player URL because they need them to render the page.

For desktop builds, configure the public `DESKTOP_API_BASE_URL` and exact approved `DESKTOP_MEDIA_ORIGINS`, then run:

```sh
npm run build:desktop:web
npm run desktop:build -- --locked
```

A native build also requires Rust 1.90 or newer and the Windows C++ build tools. CI builds the installer, checks installation and uninstallation, verifies single-instance launches and native Save As exports, and tests the packaged app in an isolated WebView2 environment. Release installers never include the automation harness.

Windows installer tools are downloaded with bounded retries, checked against pinned SHA-256 hashes, and cached inside the ignored build directory. CI can use GitHub's authenticated asset download endpoint when the public release download fails.

## Security and release notes

Catalog responses are size-limited before JSON parsing and validated before use or caching. API requests omit cookies and reject redirects. Source readers use fixed HTTPS origins, DNS checks, response limits and bounded queues. A rejected source page gets its own cooldown; rate limits apply across its host.

See [security controls](docs/security.md), [security operations](docs/security-operations.md), [player protection](docs/player-protection.md) and [release notes](CHANGELOG.md).
