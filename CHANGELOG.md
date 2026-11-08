# Changelog

## 1.1.3

- Added all-time and recent popular categories, ongoing Asian dramas, and ongoing Korean variety shows, with navigation links and pagination.
- Search now checks the full catalog. Asian-origin checks reject unrelated foreign titles, and metadata cache revisions prevent old matches from returning. Corrected the Korean drama Trigger.
- Grouped the watchlist into status folders with 20 dramas per page. Hover trash controls require confirmation before removal, and destructive buttons use visible red styling.
- Library exports open a native Save As dialog on Windows. Supported browsers use a save-location picker; other browsers follow their download settings.
- Reopening the desktop app restores the existing window instead of creating another instance. Updated the desktop icon to use the current favicon.
- Fixed theme-toggle contrast and mobile navigation wrapping. Successful catalog searches return without waiting for homepage fallback sources.
- Windows installer tools now use bounded download retries, an alternate official asset endpoint, and pinned SHA-256 checks.

Windows downloads remain unsigned. Saved library data is preserved during upgrades. Third-party player restrictions and the advertisement-filter limitations described below still apply.

## 1.1.2

- Upgrades replace the app and uninstaller in place, avoiding the broken legacy “Uninstall before installing” path. Windows checks reproduce an older uninstall command that always fails, then verify upgrade and removal succeed.
- Read published English episode translations from individual guide pages when the season index defaults to Korean. English fields survive metadata merges, and previously cached non-Latin display text is refreshed. Generic English episode labels remain when no translation is published.
- Refreshed pinned advertising-host rules and expanded desktop advertising-overlay selectors. Stylesheet restoration now yields between frames if a player removes the protection style repeatedly.
- Removed only the watch-page ad-protection toast. Other notifications remain available.
- Added a footer notice explaining that the site and app do not host video files and that content comes from non-affiliated third parties.

Website popup protection remains enabled. Browser security still prevents filtering every overlay inside a third-party iframe; advertisements merged into the actual video cannot be removed by these filters. Windows downloads remain unsigned.

## 1.1.1

- Closing the desktop window explicitly closes the isolated player and exits the app.
- Installer and uninstaller check the exact executable path, avoiding false running-app messages from scanners and Explorer file handles. A different portable copy is left alone.
- Desktop player protection hides marked advertising overlays and disables the observed transparent click shield. It restores its stylesheet if the player replaces the document head, while preserving controls, subtitles, and verification prompts.
- Windows checks now cover close/exit with active playback, unrelated file handles, portable-copy isolation, and removal of an installed background process.

Browser iframe sandboxing blocks popups and navigation. It cannot remove banners inside a third-party player's document. These Windows downloads remain unsigned; manual updates and SHA-256 checksums are provided.

## 1.1.0

- Replaced the navigation's library icon with a profile icon. The profile page still contains the saved library and import/export controls.
- Added 24-episode pagination to drama pages and shared watched-history lookups, reducing work for large shows.
- Added streaming limits and response validation before catalog JSON is used or cached. API requests now reject redirects.
- Prevented persistent content caches from storing searches or playback responses, and improved browser-cache recovery after a database version change.
- Fixed mobile and tablet overflow, oversized cards, breadcrumbs and compact navigation.
- Added independent metadata and poster fallbacks, cast pagination, episode guides and background recovery for delayed details.
- Kept popup protection built in, added transient problem notifications, and improved playback server selection and recovery.
- Published Windows installers and portable builds with SHA-256 checksums. Installers remain unsigned; signed automatic updates are disabled.
