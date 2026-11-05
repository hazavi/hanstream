# Desktop loading and hosting

The 1.0.1 patch separates playback lookup from optional drama metadata, removes opportunistic archive crawls from player requests, and limits explicit archive scans to eight pages. A failed latest index does not skip a verified older episode page. Reader timeouts pause only the failed page; explicit rate limits and access denials still pause the source origin. Empty metadata is retried instead of retained for six hours.

Desktop catalog records can survive an app restart for up to one day in SQLite. Browser catalog records use IndexedDB. Background results notify mounted views, successful homepage sections survive partial outages, and cached data is available while the service wakes. Slow local-cache reads have a 300 ms budget. A timed-out backend request can share one bounded health check and retry with a new timeout. Playback URLs are excluded from durable caching.

The player remembers an explicitly selected server for each drama, offers a reload control, and stops presenting an indefinite player-loading message. A loaded iframe is not proof that video playback started: its contents belong to another origin. A host can return an error or block the client inside an otherwise successfully loaded iframe. The media sandbox and native permissions remain restricted.

## Choosing a host or shared cache

An always-on Node backend is the simplest way to remove Render Free's wake-up delay. Render documents spin-down after 15 minutes without traffic and roughly one minute to start again: https://render.com/docs/free

KeyDB is a Redis-compatible cache, not a replacement application host. The app's optional server-side CACHE_URL integration can be evaluated with a compatible TLS service, but no KeyDB server has been provisioned or tested here. Putting a cache behind a sleeping application does not make that application answer requests while asleep. Official documentation: https://docs.keydb.dev/

If hosting must stay free, a Cloudflare Worker with Workers KV in front of the read-only catalog endpoints is a suitable next step. It can serve a previously cached catalog independently of Render, then refresh it in the background. Cache only successful public catalog metadata and images; do not persist expiring playback URLs, library data, access-denied pages, or diagnostics. KV's eventual consistency is suitable for catalog snapshots, not an authoritative watch-history store: https://developers.cloudflare.com/kv/concepts/how-kv-works/

A Cloudflare gateway needs an account, KV namespace, and public endpoint before changing the desktop API address. It has not been deployed by this patch. Neither KeyDB nor Cloudflare can make an external video host accept a rejected embed.

## Further fixes in 1.0.2

The reported player loaded real video when tested as an independent browser page; its iframe integration was incompatible with the app sandbox. Desktop playback now uses an unprivileged native child view with restricted navigation and no library bridge. The page layout and episode list remain in the main app. The website sandbox is unchanged.

Homepage assembly has a 2.5-second response budget and publishes completed sections afterward. It no longer crawls individual metadata pages before returning editorial lists. Live protected-reader checks returned twelve recent episodes initially, then six reviews, six weekly trending entries, and ten airing entries from the completed snapshot. These are individual network samples, not a guarantee for all connections or cold hosts.

Image requests now wait in a bounded queue. A busy or timed-out image lookup returns a short retry response instead of declaring the poster unavailable. Missing artwork is still shown honestly when no verified image can be found.

Editorial lists also read the publisher's public RSS feed. It supplies dated episode recaps when the homepage cannot be read, with the same source restrictions and response-size limits. General news is excluded from reviews. Weekly coverage is labelled "Featured this week"; it does not claim audience popularity or manufacture most-viewed rankings.
