import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { load } from 'cheerio';
import { createHash } from 'node:crypto';
const root = path.resolve(process.env.HANSTREAM_DESKTOP === '1' ? 'desktop-out' : 'out');
const forbidden = /(?:^|\/)(?:\.env[^/]*|api|data|node_modules|server-config\.mjs|playback-catalog\.json|drama-metadata\.json)(?:\/|$)/;
let count = 0;
async function walk(directory) {
  for (const entry of await readdir(directory)) {
    const file = path.join(directory, entry);
    const relative = path.relative(root, file).split(path.sep).join("/");
    if (forbidden.test(relative)) throw new Error(`Private or server file in Pages artifact: ${relative}`);
    if ((await stat(file)).isDirectory()) await walk(file);
    else {
      count++;
      if (/\.(?:js|html|txt|json)$/.test(entry)) {
        const content = await readFile(file, "utf8");
        if (entry.endsWith('.html')) {
          const $ = load(content);
          const policy = $('meta[http-equiv="Content-Security-Policy"]').attr('content') || '';
          const scriptPolicy = policy.split(';').find(directive => directive.trim().startsWith('script-src ')) || '';
          if (!policy.includes("object-src 'none'") || !policy.includes("base-uri 'none'") || /unsafe-inline|unsafe-eval/.test(scriptPolicy)) throw new Error(`Missing or unsafe script policy in ${relative}`);
          $('script:not([src])').each((_, element) => {
            const hash = createHash('sha256').update($(element).html() || '').digest('base64');
            if (!scriptPolicy.includes(`'sha256-${hash}'`)) throw new Error(`Unapproved inline script in ${relative}`);
          });
        }
        if (/(?:STREAM_SOURCE_URL|METADATA_SOURCE_URL|EDITORIAL_SOURCE_URL|DETAILS_SOURCE_URL|CATALOG_SOURCE_URL|MEDIA_SOURCE_URL|ARTWORK_SOURCE_URL|REFERENCE_SOURCE_URL|GUIDE_SOURCE_URL|COLLECTION_SOURCE_URL|PLAYBACK_FALLBACK_URLS|POSTER_SEARCH_URLS|SIMKL_CLIENT_ID|CACHE_URL|DIAGNOSTICS_TOKEN|IMAGE_ORIGINS|TAURI_SIGNING_PRIVATE_KEY)/.test(content)) throw new Error(`Private configuration reference in ${relative}`);
        for (const name of ["STREAM_SOURCE_URL", "METADATA_SOURCE_URL", "EDITORIAL_SOURCE_URL", "DETAILS_SOURCE_URL", "CATALOG_SOURCE_URL", "MEDIA_SOURCE_URL", "ARTWORK_SOURCE_URL", "REFERENCE_SOURCE_URL", "GUIDE_SOURCE_URL", "COLLECTION_SOURCE_URL", "PLAYBACK_FALLBACK_URLS", "POSTER_SEARCH_URLS", "CACHE_URL", "DIAGNOSTICS_TOKEN", "IMAGE_ORIGINS", "TAURI_SIGNING_PRIVATE_KEY"]) {
          const value = process.env[name];
          if (value && content.includes(value)) throw new Error(`Private configuration value in ${relative}`);
        }
      }
    }
  }
}
await walk(root);
for (const route of ["", "popular/", "recently-added/", "recent-movies/", "ongoing/", "ongoing-kshows/", "search/", "profile/", "drama/", "watch/"]) await stat(path.join(root, route, "index.html"));
console.log(`Verified ${count} public files and all Pages routes.`);
