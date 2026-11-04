# Deploy on Render

The full Next.js website runs at https://hanstream-backend.onrender.com/. Its pages and read-only catalog routes share one origin. GitHub Pages is no longer used.

## Service configuration

The existing Docker web service uses the repository's `Dockerfile` and `render.yaml`, on the Free plan. Source origins stay in Render's private environment and the ignored local `.env.local` file. Keep all private reader settings out of `NEXT_PUBLIC_` variables.

Set `SITE_URL` and `FRONTEND_ORIGINS` to the public Render origin. The desktop app's exact `https://tauri.localhost` origin is also permitted. `/api/health` reports readiness without exposing source configuration.

Pushes to `master` deploy through Render's Git integration. The security workflow builds the standalone application, checks types and dependencies, and verifies the native dependency graph. There is no Pages export deployment.

## Local builds

Run `npm run dev` for development. Run `npm run build:backend` to produce the standalone server used by Docker. Stop a local production preview before rebuilding its files on Windows.

The desktop app uses an isolated static frontend export plus the public Render catalog address. That export is packaged inside the installer and is not a GitHub Pages website. See [desktop setup](desktop.md).

## Caching and limits

The server keeps bounded HTML and assembled metadata caches. Browser and desktop caches reuse successful responses; expiring playback URLs must be refreshed. Render Free can sleep after idle, so its first request can still need a wake-up. Local caching does not turn that hosting plan into an always-on service.

Images use bounded recovery and caching. A genuinely unpublished poster uses a placeholder instead of repeated failing requests. Private source configuration and library data never belong in public deployment artifacts.
