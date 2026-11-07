# Changelog

## 1.1.0

- Replaced the navigation's library icon with a profile icon. The profile page still contains the saved library and import/export controls.
- Added 24-episode pagination to drama pages and shared watched-history lookups, reducing work for large shows.
- Added streaming limits and response validation before catalog JSON is used or cached. API requests now reject redirects.
- Prevented persistent content caches from storing searches or playback responses, and improved browser-cache recovery after a database version change.
- Fixed mobile and tablet overflow, oversized cards, breadcrumbs and compact navigation.
- Added independent metadata and poster fallbacks, cast pagination, episode guides and background recovery for delayed details.
- Kept popup protection built in, added transient problem notifications, and improved playback server selection and recovery.
- Published Windows installers and portable builds with SHA-256 checksums. Installers remain unsigned; signed automatic updates are disabled.
