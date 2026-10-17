import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("out");
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
        if (/(?:STREAM_SOURCE_URL|METADATA_SOURCE_URL|EDITORIAL_SOURCE_URL|DETAILS_SOURCE_URL|SIMKL_CLIENT_ID)/.test(content)) throw new Error(`Private configuration reference in ${relative}`);
        for (const name of ["STREAM_SOURCE_URL", "METADATA_SOURCE_URL", "EDITORIAL_SOURCE_URL", "DETAILS_SOURCE_URL"]) {
          const value = process.env[name];
          if (value && content.includes(value)) throw new Error(`Private configuration value in ${relative}`);
        }
      }
    }
  }
}
await walk(root);
for (const route of ["", "popular/", "recently-added/", "recent-movies/", "search/", "schedule/", "profile/", "drama/", "watch/"]) await stat(path.join(root, route, "index.html"));
console.log(`Verified ${count} public files and all Pages routes.`);
