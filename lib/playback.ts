import "server-only";
import { cache } from "react";
import { load } from "cheerio";
import { cleanText, httpsUrl, readHtml, sourceUrl } from "./html";
import { createRuntimeCache } from "./runtime-cache";
import { normalizeTitle, type CatalogTitle } from "./catalog";
import { getSourceConfig } from "./server-config.mjs";
import { availablePlayerServers } from "./player-availability";
import { findFallbackEpisode } from './playback-fallback';

const BASE = getSourceConfig().streamOrigin;
export type PlaybackTitle = CatalogTitle & { episode?: number };
export type PlaybackStream = {
  url: string;
  pageUrl: string;
  servers: { name: string; url: string }[];
};

export function parsePlaybackTitle(
  text: string,
  url: string,
): PlaybackTitle | null {
  if (
    !sourceUrl(url, BASE) ||
    !/^\/embed\/[^/]+\.html$/.test(new URL(url).pathname)
  )
    return null;
  const episode = /\s+Ep(?:isode)?\s+(\d+(?:\.\d+)?)\s*$/i.exec(text);
  const movie = /\b(?:full .*movie|movie)\s*$/i.test(text);
  const year =
    Number(
      text.match(/\((?:(?:Lakorn|Drama|TV series|Movie)\s+)?(\d{4})\)/i)?.[1],
    ) || undefined;
  const title = text
    .replace(/\s+Ep(?:isode)?\s+\d+(?:\.\d+)?\s*$/i, "")
    .replace(/\s+Full\b.*$/i, "")
    .replace(/\s*\((?:(?:Lakorn|Drama|TV series|Movie)\s+)?\d{4}\)\s*/i, " ")
    .trim();
  return title
    ? {
        title,
        year,
        movie,
        url,
        image: "/file.svg",
        episode: episode ? Number(episode[1]) : undefined,
      }
    : null;
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

export function parsePlaybackPage(
  html: string,
  pageUrl: string,
): PlaybackStream | null {
  const $ = load(html);
  const excluded = new Set(getSourceConfig().excludedPlaybackOrigins);
  const playerUrl = (value: string | undefined) => {
    const url = httpsUrl(value, pageUrl);
    return url && !excluded.has(new URL(url).origin) ? url : undefined;
  };
  const servers: PlaybackStream["servers"] = [];
  // The source delays iframe loading; data-video is the actual streaming URL.
  $(".server-item[data-video]").each((_, el) => {
    const url = playerUrl($(el).attr("data-video"));
    if (url && !servers.some((server) => server.url === url))
      servers.push({ name: cleanText($(el).text()) || "Server", url });
  });
  const iframe = $("#embedvideo");
  const url =
    playerUrl(iframe.attr("data-src") || iframe.attr("src")) || servers[0]?.url;
  if (!url) return null;
  if (!servers.length) servers.push({ name: "Server 1", url });
  return { url, pageUrl, servers };
}

const latestCatalog = createRuntimeCache(async () => {
  const html = await readHtml(BASE, 300);
  const items = parsePlaybackCatalog(html);
  if (!items.length)
    throw new Error("Playback catalog is temporarily unavailable.");
  return { html, items };
}, 300_000);

let indexedItems: PlaybackTitle[] = [];

const fullCatalog = createRuntimeCache(async (): Promise<PlaybackTitle[]> => {
  const { html, items } = await latestCatalog();
  const $ = load(html);
  const numbers = $(".page-numbers[href]")
    .map((_, element) => {
      const address = sourceUrl($(element).attr("href"), BASE);
      return address
        ? Number(
            /^\/list\/(\d+)\.html$/.exec(new URL(address).pathname)?.[1],
          ) || 0
        : 0;
    })
    .get();
  const last = Math.max(0, ...numbers);
  if (last > 5000) throw new Error("Unrecognized playback catalog pagination.");
  const pages: PlaybackTitle[][] = [];
  const discovered = new Map(items.map((item) => [item.url, item]));
  let next = 0;
  let failed = false;
  // Read public pagination with two workers, keeping the source's newest-first order.
  const workers = await Promise.allSettled(
    [0, 1].map(async () => {
      while (next < Math.min(last, 8) && !failed) {
        const index = next++;
        try {
          pages[index] = parsePlaybackCatalog(
            await readHtml(`${BASE}/list/${last - index}.html`, 900),
          );
          if (!pages[index].length)
            throw new Error(
              "Playback catalog page is temporarily unavailable.",
            );
          pages[index].forEach((item) => discovered.set(item.url, item));
          indexedItems = [...discovered.values()];
        } catch (error) {
          failed = true;
          throw error;
        }
        if (next < last)
          await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }),
  );
  const error = workers.find((worker) => worker.status === "rejected");
  if (error?.status === "rejected") throw error.reason;
  return [
    ...new Map(
      [...items, ...pages.flat()].map((item) => [item.url, item]),
    ).values(),
  ];
}, 900_000);

export const getPlaybackCatalog = cache(
  async (latestOnly = false): Promise<PlaybackTitle[]> => {
    if (!latestOnly) return fullCatalog();
    const { items } = await latestCatalog();
    return items;
  },
);

export async function getPlaybackEpisodes(
  title: string,
  year?: number,
  movie = false,
): Promise<PlaybackTitle[]> {
  const wanted = normalizeTitle(title);
  const latest = await getPlaybackCatalog(true);
  return [
    ...new Map(
      [...latest, ...indexedItems].map((item) => [item.url, item]),
    ).values(),
  ]
    .filter(
      (item) =>
        normalizeTitle(item.title) === wanted &&
        Boolean(item.movie) === movie &&
        (!year || item.year === year),
    )
    .sort((a, b) => (a.episode || 1) - (b.episode || 1));
}

export async function getPlaybackStream(
  title: string,
  episode: string,
  movie = false,
  year?: number,
  season = 1,
): Promise<PlaybackStream | null> {
  if (
    !/^\d+(?:\.\d+)?$/.test(episode) ||
    !Number.isInteger(season) ||
    season < 1
  )
    return null;
  // A later season must match that season's title. Never silently play season one.
  const embeddedSeason = Number(/\bseason\s+(\d+)$/i.exec(title)?.[1]);
  if (embeddedSeason && season > 1 && embeddedSeason !== season) return null;
  const titles =
    season > 1 && !embeddedSeason ? [`${title} Season ${season}`] : [title];
  async function fromPage(
    html: string,
    address: string,
  ): Promise<PlaybackStream | null> {
    const stream = parsePlaybackPage(html, address);
    if (!stream) return null;
    let servers = await availablePlayerServers(stream.servers);
    if (!servers.length) {
      // A source may have replaced a removed upload since its page was cached.
      const current = parsePlaybackPage(await readHtml(address, 0), address);
      if (current) servers = await availablePlayerServers(current.servers);
    }
    return servers.length ? { ...stream, url: servers[0].url, servers } : null;
  }
  for (const candidate of titles) {
    const indexed = (async () => {
      const entries = await getPlaybackEpisodes(candidate, year, movie).catch(
        () => [],
      );
      for (const page of entries
        .filter((item) => movie || item.episode === Number(episode))
        .slice(0, 3)) {
        try {
          const stream = await fromPage(
            await readHtml(page.url, 900),
            page.url,
          );
          if (stream) return stream;
        } catch {
          /* Try another verified listing. */
        }
      }
      return null;
    })();
    // Published episode routes follow the title/year pattern. A candidate is
    // accepted only after its real page title confirms title, year and episode.
    const direct = (async () => {
      if (!movie && year) {
        const address = `${BASE}/embed/${normalizeTitle(candidate).replace(/ /g, "-")}-${year}-ep-${episode}.html`;
        try {
          const html = await readHtml(address, 900);
          const identity = parsePlaybackTitle(
            cleanText(load(html)("title").text()).replace(/^Watch\s+/i, ""),
            address,
          );
          if (
            identity &&
            normalizeTitle(identity.title) === normalizeTitle(candidate) &&
            identity.year === year &&
            identity.episode === Number(episode)
          ) {
            const stream = await fromPage(html, address);
            if (stream) return stream;
          }
        } catch {
          /* An unverified route is never offered as a stream. */
        }
      }
      return null;
    })();
    // A slow index must not hold up a verified episode route, or vice versa.
    const first = await Promise.any(
      [indexed, direct].map((task) =>
        task.then((stream) => {
          if (stream) return stream;
          throw new Error("No verified stream");
        }),
      ),
    ).catch(() => null);
    if (first) return first;
    // Playback must never trigger an archive crawl. Reuse only already indexed
    // nonstandard routes; archive discovery belongs to explicit catalog browsing.
    const found = indexedItems.find(
      (item) =>
        normalizeTitle(item.title) === normalizeTitle(candidate) &&
        Boolean(item.movie) === movie &&
        (!year || item.year === year) &&
        (movie || item.episode === Number(episode)),
    );
    if (found) {
      try {
        const stream = await fromPage(await readHtml(found.url, 900), found.url);
        if (stream) return stream;
      } catch { /* The independent public fallback can still supply this episode. */ }
    }
  }
  if (!movie && year) return (await findFallbackEpisode(title, year, episode, season))?.stream || null;
  return null;
}
