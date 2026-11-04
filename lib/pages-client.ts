import type { SearchResponse } from "./api-types";
import { pagesRoute } from "./pages-routes";

const responses = new Map<string, { expires: number; value: unknown }>();
export function clearBackendCache() { responses.clear(); }

export async function readBackend<T>(path: string, signal?: AbortSignal): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new Error("The site connection has not been configured. Drama listings and playback will be available once it is connected.");
  if (signal?.aborted) throw signal.reason || new DOMException("Request aborted", "AbortError");
  const key = `${base.replace(/\/$/, "")}${path}`;
  const saved = responses.get(key);
  if (saved && saved.expires > Date.now()) return saved.value as T;
  const response = await fetch(`${base.replace(/\/$/, "")}${path}`, { signal, credentials: "omit" });
  if (!response.ok) throw new Error("Unable to load this page. Please try again.");
  const value = await response.json();
  if (!path.startsWith('/api/episode/') || value?.result?.video) responses.set(key, { value, expires: Date.now() + 30_000 });
  if (responses.size > 50) responses.delete(responses.keys().next().value!);
  return value as T;
}
export async function fetchSearchClient(query: string, page = 1): Promise<SearchResponse> {
  const data = await readBackend<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}&page=${page}`);
  return { results: data.results.map(item => ({ ...item, "detail-link": pagesRoute(item["detail-link"]) })) };
}
