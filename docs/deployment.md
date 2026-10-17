# Publish on GitHub Pages

The frontend is exported to `out/`. Live metadata and playback are read by a separate Node backend. The frontend contains the public backend address; private source origins belong only in the backend environment.

## 1. Deploy the backend

Build the included `Dockerfile` on a host that supports Node containers and public HTTPS. The service listens on `PORT` (default 3000), and `/api/health` is its health check.

Set these private environment variables on that service, using the values from your local `.env.local`:

- `STREAM_SOURCE_URL`
- `METADATA_SOURCE_URL`
- `EDITORIAL_SOURCE_URL`
- `DETAILS_SOURCE_URL`
- `FRONTEND_ORIGINS=https://hazavi.github.io`

`FRONTEND_ORIGINS` accepts comma-separated exact origins without paths or trailing slashes. Add the custom domain's origin if you later use one.

For a local container check:

```sh
docker build -t hanstream-backend .
docker run --rm --env-file .env.local -p 3000:3000 hanstream-backend
```

Environment files and the `data/` directory are excluded from the Docker build context. The image uses non-secret build origins; runtime variables supply the real configuration. Keep the backend source and environment private, and expose its HTTPS service. No catalog files or sync commands are required. The backend loads live HTML and keeps its catalogs in process memory. Allow the backend to stay running: older episodes are indexed in the background, and the first search or older episode request may wait for that index. A cold start depends on the sources being available.

## 2. Configure GitHub

In the repository's **Settings → Secrets and variables → Actions → Variables**, add `API_BASE_URL` with the backend's public HTTPS origin. Use no path, query, username, or password.

In **Settings → Pages**, select **GitHub Actions** as the build source. Push these changes to `master` or `main`, or run **Deploy GitHub Pages** manually from Actions. The workflow runs tests, exports only the frontend, checks its contents, and deploys the Pages artifact.

The build job needs `pages: read` for `actions/configure-pages`; the deployment job separately has `pages: write` and `id-token: write`. If configuration reports `Get Pages site failed: Not Found`, check that the workflow includes the build permission and that the Pages build source is GitHub Actions. Do not add `enablement: true` with the default workflow token: that option requires a separate token with permission to manage Pages settings.

With the current repository name, the frontend will be at `https://hazavi.github.io/hanstream/`. The workflow gets the base path from GitHub, so repository Pages and a custom domain use the correct asset paths.

The workflow deliberately fails with a clear error until `API_BASE_URL` is set. Do not add source origins or credentials as public build variables.

## Local verification

In PowerShell, with the backend running on port 3000:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000'
$env:PAGES_BASE_PATH = '/hanstream'
npm run build:pages
node scripts/verify-pages.mjs
npm run preview:pages
```

Open `http://localhost:4173/hanstream/`. For the local frontend, include `http://localhost:4173` in the backend's `FRONTEND_ORIGINS` and restart the backend after changing it.

Drama and episode URLs use `/drama/?id=...` and `/watch/?id=...&episode=...`, allowing refreshes and direct visits on static hosting. Watchlists and progress stay in the browser. Stream addresses must reach the browser to play; private environment variables keep source configuration out of the static build, but cannot conceal a requested player's address from browser developer tools. No catalog files are tracked or packaged. Files committed in older Git revisions remain in that history until it is explicitly rewritten.

Build the regular server app with `npm run build`, or the container-ready standalone output with `npm run build:backend`.

The production dependency audit passes. The development lint dependency chain still has six high-severity advisories involving glob pattern parsing; npm currently proposes a framework lint-config downgrade to remove them. Those packages are not exposed by the exported frontend. Recheck `npm audit` when updating the lint tooling.
