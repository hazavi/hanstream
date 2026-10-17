# HanStream

An Asian drama app with episode playback, a browser-local watchlist, ratings, and viewing progress. The interface uses a dark glass theme with blue accents and supports light mode.

## Develop

```bash
npm install
# Copy .env.example to .env.local and set the four private source origins.
npm run dev
```

Source configuration lives in the ignored .env.local file. Set STREAM_SOURCE_URL, METADATA_SOURCE_URL, EDITORIAL_SOURCE_URL, and DETAILS_SOURCE_URL to HTTPS origins. No API keys are required. Remote readers use public HTML, and the app's own routes expose only the data needed for browsing and playback. Metadata and playback catalogs are included in the repository, with cached refreshes and saved data used when a page is unavailable.

The source readers are marked server-only. Never prefix these variables with NEXT_PUBLIC_ or add them to next.config.env. Refresh scripts load the same local environment automatically. On deployment, set the variables in the hosting service's private server environment.

Environment variables keep source configuration out of the client bundle. The browser still receives the final player URL and displayed images and metadata because it needs them to render the app.

The homepage includes latest episodes, popular dramas, reviews, weekly trends, premieres, and finales. Cards open internal drama pages. Source labels and outbound navigation are omitted from the interface; playback servers use numbered controls.

## Refresh catalog data

```bash
npm run sync:metadata
npm run sync:playback
```

The first command refreshes drama metadata. The second refreshes the episode index. Both keep previous valid data when a refresh fails. Run these before building to package a refreshed catalog. The server also refreshes public index pages periodically and looks up missing drama details when needed.

Weekly lists use published dates and Monday to Sunday in Europe/Copenhagen. No finale is inferred from an episode count. Title matching includes the release year so different remakes are kept separate.

## Validate and build

```bash
npm test -- --run
npm run build
npm start
```

Personal watch data stays in the browser's local storage. Readable drama routes include the title and release year, and existing numeric routes remain supported.

## GitHub Pages

Use the [deployment guide](docs/deployment.md) for the Pages frontend and separate private backend. The included workflow publishes only the static frontend. Set the repository variable `API_BASE_URL` after deploying the backend.
