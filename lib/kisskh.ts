/** Resolve public episode embeds from kisskh.space without exposing a general URL proxy. */
export type KisskhStream = { url: string; pageUrl: string };

function decodeHtml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function safeHttpUrl(value: string, base = "https://kisskh.space") {
  try {
    const url = new URL(decodeHtml(value), base);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function normalized(value: string) {
  return value.toLowerCase().replace(/\(\d{4}\)/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export async function getKisskhStream(title: string, episode: string, movie = false): Promise<KisskhStream | null> {
  if (!/^\d+(?:\.\d+)?$/.test(episode)) return null;
  try {
    const searchUrl = `https://kisskh.space/?s=${encodeURIComponent(movie ? title : `${title} Ep ${episode}`)}`;
    const search = await fetch(searchUrl, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!search.ok) return null;
    const html = await search.text();
    const candidates = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => ({
        url: safeHttpUrl(match[1]),
        text: normalized(match[2].replace(/<[^>]+>/g, "")),
      }))
      .filter((item) => item.url?.startsWith("https://kisskh.space/") && item.url !== "https://kisskh.space/");
    const wanted = normalized(title);
    const episodePattern = new RegExp(`\\bep(?:isode)?\\s*${episode.replace(".", "\\.")}\\b`, "i");
    const page = candidates.find((item) => item.text.includes(wanted) && (movie || episodePattern.test(item.text)));
    if (!page?.url) return null;
    const pageUrl = page.url;
    const response = await fetch(pageUrl, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const pageHtml = await response.text();
    const embeds = [...pageHtml.matchAll(/<iframe\b[^>]*\b(?:src|data-src)=["']([^"']+)["']/gi)]
      .map((match) => safeHttpUrl(match[1], pageUrl))
      .filter((url): url is string => Boolean(url) && !/google|facebook|youtube|doubleclick/i.test(url || ""));
    const url = embeds.find((embed) => /vidmoly|streamtape|mixdrop|streamhq|dood|vidhide/i.test(embed)) || embeds[0] || null;
    if (!url) return null;
    return { url, pageUrl };
  } catch (error) {
    console.warn("Kisskh stream unavailable:", error);
    return null;
  }
}
