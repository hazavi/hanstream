import "server-only";
import { load } from "cheerio";
import { fetch } from "undici";
import { publicDispatcher } from "./outbound";
import { safeEmbedUrl } from "./embed";

type Availability = "missing" | "unknown";
const saved = new Map<string, { value: Availability; expires: number }>();
const pending = new Map<string, Promise<Availability>>();

/** Detect explicit removal pages, never infer removal from a challenge or timeout. */
export function isRemovedPlayer(html: string) {
  const $ = load(html);
  return $("title,h1,h2,.error-title,.error-message")
    .toArray()
    .some((node) =>
      /^(?:(?:sorry[,!]?\s*)?(?:this\s+)?(?:video|file)\s+(?:(?:is|was|has been)\s+)?(?:not found|deleted|removed|unavailable))[!.\s]*$/i.test(
        $(node).text().trim(),
      ),
    );
}
function allowed(value: string) {
  const safe = safeEmbedUrl(value);
  if (!safe) return;
  const origins = (
    process.env.PLAYER_ORIGINS ||
    process.env.DESKTOP_MEDIA_ORIGINS ||
    ""
  )
    .split(",")
    .map((item) => item.trim());
  return origins.includes(new URL(safe).origin) ? safe : undefined;
}
async function check(value: string): Promise<Availability> {
  if (process.env.VERCEL === "1" || process.env.HANSTREAM_ROLE === "web")
    return "unknown";
  const url = allowed(value);
  if (!url) return "unknown";
  const old = saved.get(url);
  if (old && old.expires > Date.now()) return old.value;
  const existing = pending.get(url);
  if (existing) return existing;
  if (pending.size >= 4) return "unknown";
  const task = (async (): Promise<Availability> => {
    try {
      const response = await fetch(url, {
        dispatcher: publicDispatcher,
        redirect: "manual",
        headers: {
          Accept: "text/html",
          "User-Agent": "HanStream/1.1 (player availability check)",
        },
        signal: AbortSignal.timeout(1500),
      });
      if (response.status === 404 || response.status === 410) {
        await response.body?.cancel();
        return "missing";
      }
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("text/html") ||
        Number(response.headers.get("content-length")) > 262144
      ) {
        await response.body?.cancel();
        return "unknown";
      }
      const reader = response.body?.getReader();
      if (!reader) return "unknown";
      let size = 0;
      const parts: Uint8Array[] = [];
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.length;
          if (size > 262144) {
            await reader.cancel();
            return "unknown";
          }
          parts.push(part.value);
        }
      } finally {
        reader.releaseLock();
      }
      return isRemovedPlayer(Buffer.concat(parts).toString("utf8"))
        ? "missing"
        : "unknown";
    } catch {
      return "unknown";
    }
  })()
    .then((result) => {
      saved.set(url, {
        value: result,
        expires: Date.now() + (result === "missing" ? 60_000 : 20_000),
      });
      while (saved.size > 100) saved.delete(saved.keys().next().value!);
      return result;
    })
    .finally(() => pending.delete(url));
  pending.set(url, task);
  return task;
}

export async function availablePlayerServers<T extends { url: string }>(
  servers: T[],
): Promise<T[]> {
  const candidates = servers.slice(0, 4);
  const results = await Promise.all(
    candidates.map(async (server) => ({
      server,
      state: await check(server.url),
    })),
  );
  const preferred = (process.env.PLAYER_PREFERRED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim());
  const priority = (server: T) => {
    try {
      const index = preferred.indexOf(new URL(server.url).origin);
      return index < 0 ? preferred.length : index;
    } catch {
      return preferred.length;
    }
  };
  return results
    .filter((result) => result.state !== "missing")
    .map((result) => result.server)
    .sort((a, b) => priority(a) - priority(b));
}
