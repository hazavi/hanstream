import "server-only";
import { cache } from "react";
import { load } from "cheerio";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cleanText, httpsUrl, readHtml, sourceUrl } from "./html";
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

export const getPlaybackCatalog = cache(async (): Promise<PlaybackTitle[]> => {
  let indexed: PlaybackTitle[] = [];
  try {
    const data = JSON.parse(await readFile(path.join(process.cwd(), "data/playback-catalog.json"), "utf8"));
    if (Array.isArray(data.entries)) indexed = data.entries.map((entry: { text: string; url: string }) => typeof entry.text === "string" && typeof entry.url === "string" ? parsePlaybackTitle(entry.text, entry.url) : null).filter((item: PlaybackTitle | null): item is PlaybackTitle => Boolean(item));
  } catch { /* The full index is optional; the latest page still works. */ }
  try {
    const latest = parsePlaybackCatalog(await readHtml(BASE, 600));
    const latestUrls = new Set(latest.map(item => item.url));
    return [...latest, ...indexed.filter(item => !latestUrls.has(item.url))];
  } catch (error) {
    if (indexed.length) return indexed;
    throw error;
  }
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
