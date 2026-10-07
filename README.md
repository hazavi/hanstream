# HanStream

A Next.js app for discovering dramas and tracking what you watch.

## Data sources

- [Simkl](https://simkl.com/) supplies trending lists, search, details, episode lists, and the airing calendar. Create a Simkl app and put its client ID in `.env.local` using [.env.example](.env.example). Some Simkl apps require `SIMKL_ACCESS_TOKEN` on every request; store that token only in the server environment.
- [kisskh.space](https://kisskh.space/) supplies episode player embeds. The site has no documented API. When its page markup changes or no matching embed exists, playback is shown as unavailable.

Simkl IDs are used in local URLs, and drama pages link to their Simkl records.

## Personal library

Watchlist, ratings, and progress are stored in this browser's local storage. They do not sync across devices. Firebase, account sign-in, site password access, and Firebase watch parties have been removed.

## Design

The minimal soft UI theme uses warm neutral surfaces, muted sage accents, and gentle shadows. The homepage action component adapts the restrained treatment of [21st.dev's Minimal Button](https://21st.dev/@radiumcoders/components/minimal-button); the brand icon tile adapts the shape language of [21st.dev's Featured icons](https://21st.dev/community/components/untitledui/featured-icons). The play glyph and SVG favicon are original to HanStream.

## Develop

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill in `SIMKL_CLIENT_ID` before starting the app. If Simkl returns `user_token_required`, also configure `SIMKL_ACCESS_TOKEN` or use a client ID that permits public catalog reads.
