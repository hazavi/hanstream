# Performance, security, and desktop app suggestions

The app uses a GitHub Pages frontend and a separate backend. Keep private reader configuration on that backend, and keep generated catalogs out of the repository.

Implementation status: performance code is documented in [performance.md](performance.md), security controls in [security-operations.md](security-operations.md), and the Windows desktop target in [desktop.md](desktop.md). External cache provisioning, image-origin configuration, signing credentials, and live signed-update testing remain pending. The sections below retain the original recommendations and their verification goals.

Verified on 2026-11-04:

- Performance, security, and desktop changes were committed and pushed in separate stages. The deployed homepage returns live catalog content, with independently recoverable sections.
- All 232 automated tests pass. Pages deployment, backend checks, native dependency checks, and the Windows app smoke test pass in GitHub Actions. npm audit reports zero findings; the two reviewed Rust warnings do not enter the Windows build graph.
- The unsigned Windows installer is available from the successful run of the [Windows desktop workflow](https://github.com/hazavi/hanstream/actions/workflows/desktop.yml). The production executable was checked to exclude the CI debugging flag.
- Library import/export, confirmation, invalid-file rejection, deletion, production script nonces, and theme interaction were exercised in a real browser. The compiled desktop app was also exercised locally in WebView2.

Individual external video hosts can still fail or present their own verification prompts. A sampled primary embed failed in both Chrome and WebView2; an alternate rendered a video player. This does not establish that every upstream server plays successfully. Signed-update installation and recovery still require real signing credentials and an update host.

## Performance

1. **Measure cold and warm loads separately.** Record homepage load, first visible poster, search response, and detail response on a phone with a slow connection. Record backend wake-up time separately from source reads. Render Free services sleep after 15 minutes without inbound traffic, so frontend optimization alone cannot remove the wake-up delay. Keep a clear loading state; consider an always-on plan only if that delay becomes unacceptable. See [Render's Free service limits](https://render.com/docs/free).

2. **Persist successful metadata on the server.** The existing bounded memory caches, shared requests, and stale-data recovery reduce repeated reads within one process. Add a private external cache if results must survive restarts. Store fetch time and expiry, refresh in the background, and retain a known good record when a refresh fails. Do not persist expiring playback URLs as durable metadata. Local files on Render Free are lost on restart or spin-down, so a local SQLite file would not solve persistence there. See [Render's filesystem limits](https://render.com/docs/free#local-files-lost-on-redeploy).

3. **Cache image bytes and serve appropriate sizes.** The current artwork cache remembers successful candidates; it does not resize or retain image files. Consider a backend image cache with thumbnail and poster variants, fixed size limits, safe content types, and explicit expiry. Restrict upstream destinations and redirects before adding any proxy. Verify reduced transferred bytes and working poster fallbacks on both deployments.

4. **Load only the code a route needs.** Inspect the Pages frontend bundle, then split detail, watch, and trailer UI with dynamic imports where those imports reduce the initial homepage download. Keep the existing lazy animation loader. Compare bundle size and interaction timing before accepting each split. See [Next.js lazy loading](https://nextjs.org/docs/app/guides/lazy-loading).

5. **Make failures measurable without exposing configuration.** Count cache hits, lookup timeouts, empty results, and recovery attempts. Log route categories and durations, with private URLs and query content removed. Keep retries bounded; avoid making every visible card retry an unavailable host independently.

## Security

The current request validation, origin restrictions, iframe sandbox, CSP, and process limits are described in [security.md](security.md). Suggested additions:

- Run dependency audits and static artifact checks in CI. Review supported dependency upgrades and resolve the development lint-chain advisories without forced incompatible downgrades. Scan both source changes and generated public files for secrets.
- Add rate limiting at a trusted proxy or shared store if traffic grows. Give search and expensive detail lookups separate budgets. Trust forwarded client IP headers only from a configured proxy; the existing concurrency cap protects one process, not the whole deployment.
- If introducing an image proxy, block loopback, private, and link-local destinations after DNS resolution and at every redirect. Bound body size, time, and allowed MIME types. Do not turn a URL parameter into an unrestricted fetch service.
- Tighten the regular server's inline-script policy with nonces after testing Next.js hydration. Preserve the static export's script hashes. Extra frontend response headers need a host or proxy that supports them; GitHub Pages meta tags cannot supply all header protections. See [Next.js CSP guidance](https://nextjs.org/docs/app/guides/content-security-policy).
- Add safe operational logs, cache cleanup, and an incident procedure for rotating backend secrets. Never treat a frontend environment variable, desktop binary, CORS policy, or hidden filename as secret storage.

## Desktop app

Start with a **Tauri 2 playback prototype** using the existing static frontend and HTTPS backend. Tauri supports Next.js static exports, so server readers can remain outside the installer. Confirm compatibility before committing to a full desktop build. See [Tauri's Next.js integration](https://v2.tauri.app/start/frontend/nextjs/).

1. **Test playback first on Windows.** Check embedded streams, trailers, subtitles, fullscreen, cookies, keyboard controls, and recovery after the backend wakes up. Test the actual media providers; playback in a browser does not establish that it works in a desktop WebView.
2. **Package local frontend assets.** Create a separate desktop export configuration with the correct asset paths. Keep only the public backend address in the app. Add the exact desktop origin to backend CORS after checking its value on each target platform. An installer cannot keep embedded provider credentials private.
3. **Limit native permissions.** Start without filesystem, shell, or arbitrary network command access. Give each native command a narrow purpose, validate its inputs, and prevent embedded media from calling it. Explicitly scope capabilities to the main app window. See [Tauri capabilities](https://v2.tauri.app/security/capabilities/).
4. **Plan library migration.** Browser storage will not automatically become desktop storage. Add an explicit export/import option for watch history and the library, with schema validation, a size limit, and a delete-data action. Keep playback online initially; offline video downloads would require a separate design.
5. **Sign releases and updates.** Keep signing keys in CI secrets, verify update signatures, and test interrupted updates and recovery. Start with a Windows installer before adding other platforms. Signing and distribution can have costs. See [Tauri's updater requirements](https://v2.tauri.app/plugin/updater/).

If the playback prototype fails because of WebView differences, evaluate Electron as an alternative. Keep Node integration off in renderers, enable context isolation and sandboxing, restrict navigation and new windows, and expose only narrow validated preload APIs. Never grant native privileges to embedded media. See [Electron's security checklist](https://www.electronjs.org/docs/latest/tutorial/security).

Suggested order: measure current loading, address the largest measured delay, add CI security checks, then build the desktop playback prototype. Choose the desktop framework after that prototype passes.
