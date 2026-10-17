import "server-only";
import { load } from "cheerio";
import { getSourceConfig, isSourceRedirect } from "./server-config.mjs";

export const cleanText = (value: string) => value.replace(/\s+/g, " ").trim();

export function httpsUrl(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export function sourceUrl(value: string | undefined, base: string): string | undefined {
  const url = httpsUrl(value, base);
  return url && new URL(url).hostname === new URL(base).hostname ? url : undefined;
}

export class SourceUnavailable extends Error {
  constructor(public source: string) { super(`${source} is temporarily unavailable. Please try again later.`); }
}

// Only public HTML pages from the configured sources may be requested.
export async function readHtml(value: string, revalidate = 3600): Promise<string> {
  let url = new URL(value);
  const allowedOrigins = new Set(getSourceConfig().allowedOrigins);
  const source = "Catalog";
  for (let attempt = 0; attempt < 4; attempt++) {
    if (url.protocol !== "https:" || !allowedOrigins.has(url.origin) || url.username || url.password || url.port) throw new Error("Invalid source URL");
    let response: Response;
    try {
      response = await fetch(url.href, {
        headers: { Accept: "text/html", "User-Agent": "HanStream/0.2.0 (public HTML catalog reader)" },
        next: { revalidate }, redirect: "manual", signal: AbortSignal.timeout(12000),
      });
    } catch { throw new SourceUnavailable(source); }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = httpsUrl(response.headers.get("location") || undefined, url.href);
      if (!location || !allowedOrigins.has(new URL(location).origin) || !isSourceRedirect(url, new URL(location))) throw new SourceUnavailable(source);
      url = new URL(location);
      continue;
    }
    if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) throw new SourceUnavailable(source);
    const html = await response.text();
    if (html.length > 5_000_000 || /<title>\s*(?:Just a moment|Access denied|Attention Required)/i.test(html) || /cf-chl-|challenge-platform/.test(html)) throw new SourceUnavailable(source);
    return html;
  }
  throw new SourceUnavailable(source);
}

export function structuredItems(html: string): Record<string, unknown>[] {
  const $ = load(html);
  const items: Record<string, unknown>[] = [];
  function visit(value: unknown) {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    items.push(item);
    if (item["@graph"]) visit(item["@graph"]);
    if (item.itemListElement) visit(item.itemListElement);
    if (item.item) visit(item.item);
  }
  $('script[type="application/ld+json"]').each((_, el) => {
    try { visit(JSON.parse($(el).text())); } catch { /* Optional metadata may be malformed. */ }
  });
  return items;
}
