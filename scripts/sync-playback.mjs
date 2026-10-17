import './load-env.mjs';
import { getSourceConfig } from '../lib/server-config.mjs';
import { load } from "cheerio";
import { mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";

// Index only public catalog pages. No player downloads, accounts, or hidden endpoints.
const base = getSourceConfig().streamOrigin;
const entries = new Map();
const limitArg = process.argv.find(arg => arg.startsWith("--max-pages="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
if (!(limit > 0)) throw new Error("--max-pages must be positive");

async function readPage(url) {
  const response = await fetch(url, { headers: { Accept: "text/html", "User-Agent": "HanStream/0.2.0 (public HTML catalog reader)" }, signal: AbortSignal.timeout(20000), redirect: "error" });
  if (!response.ok) throw new Error(`Catalog page returned ${response.status}`);
  const html = await response.text();
  if (/cf-chl-|challenge-platform/.test(html)) throw new Error("The playback source requires interactive access; catalog was not replaced.");
  const $ = load(html);
  if (!$("a.post-title-link").length) throw new Error("No catalog entries found; index was not replaced.");
  $("a.post-title-link").each((_, el) => {
    const url = new URL($(el).attr("href"), base);
    if (url.origin !== base || !/^\/embed\/[^/]+\.html$/.test(url.pathname)) return;
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text) entries.set(url.href, { text, url: url.href });
  });
  return $;
}

const $ = await readPage(base);
const pages = $(".page-numbers[href]").map((_, el) => Number($(el).attr("href")?.match(/\/list\/(\d+)\.html/)?.[1]) || 0).get();
const last = Math.max(0, ...pages);
if (!entries.size || last > 5000) throw new Error("Unrecognized catalog markup; index was not replaced.");
const queue = Array.from({ length: Math.min(last, limit === Infinity ? last : limit - 1) }, (_, i) => last - i);
let completed = 1;
// Two workers, with a pause after each page to avoid rapid bursts.
await Promise.all([0, 1].map(async () => {
  while (queue.length) {
    const page = queue.shift();
    await readPage(`${base}/list/${page}.html`);
    completed++;
    if (completed % 25 === 0) console.log(`Read ${completed} pages, ${entries.size} episode/title links`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}));
const directory = path.resolve("data");
await mkdir(directory, { recursive: true });
const destination = path.join(directory, "playback-catalog.json");
const temporary = path.join(directory, "playback-catalog.next.json");
await writeFile(temporary, JSON.stringify({ source: base, updatedAt: new Date().toISOString(), pages: completed, complete: completed === last + 1, entries: [...entries.values()] }) + "\n");
await rename(temporary, destination);
console.log(`Saved ${entries.size} links from ${completed} pages to data/playback-catalog.json`);
