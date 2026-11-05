import "server-only";
import { load } from "cheerio";
import { getSourceConfig, isSourceRedirect } from "./server-config.mjs";
import { count } from './diagnostics';
import { publicDispatcher } from './outbound';
import { fetch as sourceFetch, type RequestInit as SourceRequestInit, type Response as SourceResponse } from 'undici';

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

const unavailableUntil = new Map<string, number>();
function pausePage(url:string) {
  unavailableUntil.set(url,Date.now()+15_000);
  if(unavailableUntil.size>250)unavailableUntil.delete(unavailableUntil.keys().next().value!);
}
const pages = new Map<string, { html: string; expires: number }>();
const pending = new Map<string, Promise<string>>();
const MAX_HTML_BYTES = 5_000_000;
const MAX_PENDING_READS = 24;
const PLAYBACK_RESERVE = 4;
export function clearHtmlCache() { pages.clear(); pending.clear(); unavailableUntil.clear(); }

// Only public HTML pages from the configured sources may be requested.
export async function readHtml(value: string, revalidate = 3600, timeout = 3500, feed = false): Promise<string> {
  const url = new URL(value);
  const sources = getSourceConfig();
  if (url.protocol !== 'https:' || !sources.allowedOrigins.includes(url.origin) || url.username || url.password || url.port) throw new Error('Invalid source URL');
  const saved = pages.get(url.href);
  if (revalidate > 0 && saved && saved.expires > Date.now()) { count('html.hit'); return saved.html; }
  const existing = pending.get(url.href);
  if (existing) return existing;
  count('html.miss');
  const capacity = url.origin === sources.streamOrigin ? MAX_PENDING_READS : MAX_PENDING_READS - PLAYBACK_RESERVE;
  if (pending.size >= capacity) {
    if (saved) return saved.html;
    throw new SourceUnavailable('Catalog');
  }
  const request = readFreshHtml(url.href, Math.min(timeout, 3500),feed).then(html => {
    if (revalidate > 0 && html.length < 1_000_000) pages.set(url.href, { html, expires: Date.now() + revalidate * 1000 });
    if (pages.size > 80) pages.delete(pages.keys().next().value!);
    return html;
  }).catch(error => {
    count('html.failure');
    if (revalidate > 0 && saved) return saved.html;
    throw error instanceof SourceUnavailable ? error : new SourceUnavailable('Catalog');
  }).finally(() => pending.delete(url.href));
  pending.set(url.href, request);
  return request;
}

export const readFeed=(value:string,revalidate=300)=>readHtml(value,revalidate,3500,true);

async function readFreshHtml(value: string, timeout: number, feed=false): Promise<string> {
  let url = new URL(value);
  const allowedOrigins = new Set(getSourceConfig().allowedOrigins);
  const source = "Catalog";
  let retried = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (url.protocol !== "https:" || !allowedOrigins.has(url.origin) || url.username || url.password || url.port) throw new Error("Invalid source URL");
    if ((unavailableUntil.get(url.origin) || 0) > Date.now() || (unavailableUntil.get(url.href)||0)>Date.now()) throw new SourceUnavailable(source);
    let response: SourceResponse;
    try {
      const options: SourceRequestInit = {
        dispatcher: publicDispatcher,
        headers: { Accept: feed?'application/rss+xml, application/xml, text/xml':'text/html', "User-Agent": "HanStream/0.2.0 (public HTML catalog reader)" },
        cache: 'no-store', redirect: "manual", signal: AbortSignal.timeout(timeout),
      };
      response = await sourceFetch(url.href, options);
    } catch (error) {
      const code = (error as { cause?: {code?:string} })?.cause?.code;
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) || code === 'UND_ERR_CONNECT_TIMEOUT') {
        pausePage(url.href);
        throw new SourceUnavailable(source);
      }
      if (!retried && !(error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))) {
        retried = true;
        await new Promise(resolve => setTimeout(resolve, 150));
        continue;
      }
      pausePage(url.href);
      throw new SourceUnavailable(source);
    }
    if ([500, 502, 503, 504].includes(response.status) && !retried) {
      await response.body?.cancel();
      retried = true;
      await new Promise(resolve => setTimeout(resolve, 150));
      continue;
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = httpsUrl(response.headers.get("location") || undefined, url.href);
      if (!location || !allowedOrigins.has(new URL(location).origin) || !isSourceRedirect(url, new URL(location))) throw new SourceUnavailable(source);
      url = new URL(location);
      continue;
    }
    if ([403, 429].includes(response.status)) unavailableUntil.set(url.origin, Date.now() + 60_000);
    if (!response.ok || !((response.headers.get("content-type") || "").includes("text/html") || feed&&/^(?:application\/(?:rss\+xml|xml)|text\/xml)(?:;|$)/i.test(response.headers.get('content-type')||''))) {
      await response.body?.cancel();
      throw new SourceUnavailable(source);
    }
    const html = await limitedHtml(response);
    // Content pages may include a challenge script alongside their published HTML.
    // Reject actual interstitial pages, without rejecting that accessible content.
    if (/<title>\s*(?:Just a moment|One moment,?\s*please|Access denied|Attention Required)/i.test(html) || /\bid=["'](?:challenge-form|cf-challenge-running|challenge-running)["']/i.test(html)) throw new SourceUnavailable(source);
    return html;
  }
  throw new SourceUnavailable(source);
}

async function limitedHtml(response: SourceResponse): Promise<string> {
  if (Number(response.headers.get('content-length')) > MAX_HTML_BYTES) {
    await response.body?.cancel();
    throw new SourceUnavailable('Catalog');
  }
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_HTML_BYTES) {
        await reader.cancel();
        throw new SourceUnavailable('Catalog');
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join('');
  } finally { reader.releaseLock(); }
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
