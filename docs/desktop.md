# Windows desktop app

The desktop target packages the static React frontend in a Tauri 2 window. Metadata readers and playback lookups still run on the HTTPS backend. The installer contains local frontend assets and the public backend address, not private source configuration or a second backend server. The website and desktop app share UI components.

## Build and run

Install Rust, Microsoft C++ Build Tools with the Desktop development with C++ workload, and WebView2. See [Tauri's Windows prerequisites](https://v2.tauri.app/start/prerequisites/#windows). The current local machine has a workspace Rust toolchain but lacks the C++ workload; Windows CI provides the native build environment.

Set `DESKTOP_API_BASE_URL` in `.env.local` to the same public HTTPS backend used by Pages. Run `npm run desktop:dev` for a development window or `npm run desktop:build -- --locked` for an installer. `npm run build:desktop:web` builds only frontend assets. These commands use `.desktop-build/` and `desktop-out/`, independently of the Pages and backend outputs. Generated connection configuration and native build files are ignored by Git.

The **Windows desktop** GitHub Actions workflow builds the unsigned Windows installer and portable executable and uploads them as an Actions artifact. It also launches the real app in WebView2 and checks its origin, local page loading, theme interaction, library controls, and restriction of external top-level navigation. Artifacts are retained for 14 days. No public GitHub release is created automatically.

The Windows app uses `https://tauri.localhost`; the backend permits exactly that origin alongside configured website origins. Changing the desktop scheme later would change where WebView2 stores the library. macOS and Linux installers are not included in this first Windows target.

## Library migration

Open **My Library**, choose **Export library**, then import the file into the other browser or desktop app. Imports require a supported format version and are limited to 1 MB. Text, identifiers, image URLs, progress, dates, ratings, and list lengths are validated. Unknown properties are discarded. Importing replaces the current library only after confirmation. **Delete saved data** requires a separate confirmation. No browser storage is copied automatically, and no library data is uploaded to the backend.

## Native restrictions

The default main-window capability grants no native commands. Filesystem, shell, arbitrary native network access, new windows, and device permission requests are not enabled. External top-level navigation is blocked; media stays inside the existing sandboxed iframe. Downloads are blocked except blobs created by the local app, used for explicit library export. The native window loads packaged assets rather than an arbitrary remote website. See [Tauri capabilities](https://v2.tauri.app/security/capabilities/).

CI enables a loopback WebView2 debugging port only while testing its process. That flag is not in the shipped configuration. Frontend script hashes and the desktop CSP restrict scripts and allow only the configured backend and Tauri's IPC transport for connections.

## Signed releases and updates

Unsigned builds do not enable the updater. Signing requires credentials that have not yet been configured. Unsigned installers can trigger Windows SmartScreen warnings.

Before running the workflow manually with **signed** enabled, configure these repository secrets:

- `WINDOWS_CERTIFICATE_BASE64` and `WINDOWS_CERTIFICATE_PASSWORD` for a Windows code-signing certificate.
- `TAURI_SIGNING_PRIVATE_KEY` and, if used, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` for Tauri updater signatures.

Configure these public repository variables:

- `API_BASE_URL`: the public HTTPS backend.
- `DESKTOP_UPDATER_PUBLIC_KEY`: the corresponding updater verification key.
- `DESKTOP_UPDATER_ENDPOINT`: the HTTPS URL that will serve the update manifest.
- `DESKTOP_DOWNLOAD_BASE_URL`: the HTTPS directory that will serve the signed installer.

The signed build fails if its keys, endpoint, or imported certificate are missing. It enables only updater check/install permissions for the local main window. **My Library** then offers an update check and an explicit install button. Tauri verifies updater signatures before installation; there is no unsigned-update fallback. The workflow prepares `latest.json` next to the signed installer and signature. Test those artifacts before publishing them at the configured URLs. See [Tauri's signed updater setup](https://v2.tauri.app/plugin/updater/).

A Windows installer signature and a Tauri update signature are separate controls. Neither is created by hiding a key in the app. Keep private signing material in CI secrets, never in the repository or desktop bundle.

## Playback checks before release

Native smoke checks do not prove every external video host works. Test actual available episodes in WebView2: start playback, switch servers, seek, show subtitles, enter/exit fullscreen, use previous/next, and reopen the app to check saved history. Also test a trailer, unavailable episodes, a waking backend, offline/reconnect, and a popup attempt. Providers that reject WebView2 or require unsupported DRM need individual investigation before the app is described as fully playback-compatible.

Signed-update download, interruption, and installer recovery checks remain pending until real signing credentials and an update host exist. Do not publish the signed release based only on an unsigned CI build.
