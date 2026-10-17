import "server-only";
import { cache } from "react";
import { load } from "cheerio";
import { cleanText, httpsUrl, readHtml, sourceUrl } from "./html";
import { createRuntimeCache } from "./runtime-cache";
import { normalizeTitle, type CatalogTitle } from "./catalog";
import { getSourceConfig } from "./server-config.mjs";

const BASE = getSourceConfig().streamOrigin;
export type PlaybackTitle = CatalogTitle & { episode?: number };
export type PlaybackStream = { url: string; pageUrl: string; servers: { name: string; url: string }[] };

export function parsePlaybackTitle(text: string, url: string): PlaybackTitle | null {
  if (!sourceUrl(url, BASE) || !/^\/embed\/[^/]+\.html$/.test(new URL(url).pathname)) return null;
  const episode = /\s+Ep(?:isode)?\s+(\d+(?:\.\d+)?)\s*$/i.exec(text);
  const movie = /\b(?:full .*movie|movie)\s*$/i.test(text);
  const year = Number(text.match(/\((\d{4})\)/)?.[1]) || undefined;
  const title = text.replace(/\s+Ep(?:isode)?\s+\d+(?:\.\d+)?\s*$/i, "").replace(/\s+Full\b.*$/i, "").replace(/\s*\(\d{4}\)\s*/, " ").trim();
  return title ? { title, year, movie, url, image: "/file.svg", episode: episode ? Number(episode[1]) : undefined } : null;
}

export function parsePlaybackCatalog(html: string): PlaybackTitle[] {
  const $ = load(html);
  const items = new Map<string, PlaybackTitle>();
  $("a.post-title-link, a[href*='/embed/']").each((_, el) => {
    const url = sourceUrl($(el).attr("href"), BASE);
    if (!url) return;
    const item = parsePlaybackTitle(cleanText($(el).text()), url);
    if (item) items.set(url, item);
  });
  return [...items.values()];
}

export function parsePlaybackPage(html: string, pageUrl: string): PlaybackStream | null {
  const $ = load(html);
  const servers: PlaybackStream["servers"] = [];
  // The source delays iframe loading; data-video is the actual streaming URL.
  $(".server-item[data-video]").each((_, el) => {
    const url = httpsUrl($(el).attr("data-video"), pageUrl);
    if (url && !servers.some(server => server.url === url)) servers.push({ name: cleanText($(el).text()) || "Server", url });
  });
  const iframe = $("#embedvideo");
  const url = httpsUrl(iframe.attr("data-src") || iframe.attr("src"), pageUrl) || servers[0]?.url;
  if (!url) return null;
  if (!servers.length) servers.push({ name: "Server 1", url });
  return { url, pageUrl, servers };
}

const latestCatalog = createRuntimeCache(async () => {
  const html = await readHtml(BASE, 300);
  const items = parsePlaybackCatalog(html);
  if (!items.length) throw new Error("Playback catalog is temporarily unavailable.");
  return { html, items };
}, 300_000);

const fullCatalog = createRuntimeCache(async (): Promise<PlaybackTitle[]> => {
  const { html, items } = await latestCatalog();
  const $ = load(html);
  const numbers = $(".page-numbers[href]").map((_, element) => {
    const address = sourceUrl($(element).attr("href"), BASE);
    return address ? Number(/^\/list\/(\d+)\.html$/.exec(new URL(address).pathname)?.[1]) || 0 : 0;
  }).get();
  const last = Math.max(0, ...numbers);
  if (last > 5000) throw new Error("Unrecognized playback catalog pagination.");
  const pages: PlaybackTitle[][] = [];
  let next = 0;
  let failed = false;
  // Read public pagination with two workers, keeping the source's newest-first order.
  const workers = await Promise.allSettled([0, 1].map(async () => {
    while (next < last && !failed) {
      const index = next++;
      try {
        pages[index] = parsePlaybackCatalog(await readHtml(`${BASE}/list/${last - index}.html`, 900));
        if (!pages[index].length) throw new Error("Playback catalog page is temporarily unavailable.");
      } catch (error) { failed = true; throw error; }
      if (next < last) await new Promise(resolve => setTimeout(resolve, 250));
    }
  }));
  const error = workers.find(worker => worker.status === "rejected");
  if (error?.status === "rejected") throw error.reason;
  return [...new Map([...items, ...pages.flat()].map(item => [item.url, item])).values()];
}, 900_000);

export const getPlaybackCatalog = cache(async (latestOnly = false): Promise<PlaybackTitle[]> => {
  if (!latestOnly) return fullCatalog();
  const { items } = await latestCatalog();
  // A long-running backend warms older episodes without delaying the homepage.
  void fullCatalog().catch(() => {});
  return items;
});

export async function getPlaybackEpisodes(title: string, year?: number, movie = false): Promise<PlaybackTitle[]> {
  const wanted = normalizeTitle(title);
  return (await getPlaybackCatalog()).filter(item => normalizeTitle(item.title) === wanted && Boolean(item.movie) === movie && (!year || item.year === year)).sort((a, b) => (a.episode || 1) - (b.episode || 1));
}

export async function getPlaybackStream(title: string, episode: string, movie = false, year?: number, season = 1): Promise<PlaybackStream | null> {
  if (!/^\d+(?:\.\d+)?$/.test(episode) || !Number.isInteger(season) || season < 1) return null;
  // A later season must match that season's title. Never silently play season one.
  const titles = season > 1 ? [`${title} Season ${season}`] : [title];
  for (const candidate of titles) {
    const entries = await getPlaybackEpisodes(candidate, year, movie);
    const page = entries.find(item => movie || item.episode === Number(episode));
    if (!page) continue;
    return parsePlaybackPage(await readHtml(page.url, 900), page.url);
  }
  return null;
}
