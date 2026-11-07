# Changelog

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
