# HanStream

An Asian drama app with episode playback, a browser-local watchlist, ratings, and viewing progress. The interface uses a dark glass theme with blue accents and supports light mode.

## Develop

```bash
npm install
# Copy .env.example to .env.local and set the four private source origins.
npm run dev
```

Source configuration lives in the ignored .env.local file. Set STREAM_SOURCE_URL, METADATA_SOURCE_URL, EDITORIAL_SOURCE_URL, and DETAILS_SOURCE_URL to HTTPS origins. No API keys are required. Remote readers use public HTML, and the app's own routes expose only the data needed for browsing and playback. Catalogs are fetched at runtime and cached inside the backend process. No metadata or playback data files are included in the repository or deployment image.

The source readers are marked server-only. Never prefix these variables with NEXT_PUBLIC_ or add them to next.config.env. On deployment, set the variables in the hosting service's private server environment.

Environment variables keep source configuration out of the client bundle. The browser still receives the final player URL and displayed images and metadata because it needs them to render the app.

The homepage includes latest episodes, popular dramas, reviews, weekly trends, premieres, and finales. Cards open internal drama pages. Source labels and outbound navigation are omitted from the interface; playback servers use numbered controls.

## Runtime catalog data

The backend reads current HTML pages after startup. Latest episodes load from the current catalog page; older episodes are indexed in the background from public pagination with two workers. The first search or older episode request may wait for that index to finish. Metadata is loaded from public indexes and detail pages, with missing drama details looked up on demand.

The process keeps live results in memory and refreshes them periodically. If a refresh fails, it keeps the data already fetched by that process. A cold backend needs the source pages to be available. Restarting clears these in-memory catalogs. The ignored `data/` directory is excluded from Docker builds.

Weekly lists use published dates and Monday to Sunday in Europe/Copenhagen. No finale is inferred from an episode count. Title matching includes the release year so different remakes are kept separate.

## Validate and build

```bash
npm test -- --run
npm run build
npm start
```

Personal watch data stays in the browser's local storage. Readable drama routes include the title and release year, and existing numeric routes remain supported.

## GitHub Pages

[Deploy the backend on Render](https://render.com/deploy?repo=https://github.com/hazavi/hanstream)

The included `render.yaml` selects a Free Docker service. Set the four private source origins when Render prompts for them. After the service is live, run `npm run connect:backend --` followed by its public HTTPS URL to verify content, save GitHub's `API_BASE_URL`, and start the Pages workflow using your existing Git sign-in.

Use the [deployment guide](docs/deployment.md) for the Pages frontend and separate private backend. The included workflow publishes only the static frontend. Set the repository variable `API_BASE_URL` after deploying the backend.
