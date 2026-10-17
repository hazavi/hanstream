import type { SearchResponse } from "./api-types";
import { pagesRoute } from "./pages-routes";

export async function readBackend<T>(path: string, signal?: AbortSignal): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new Error("The site connection has not been configured.");
  const response = await fetch(`${base.replace(/\/$/, "")}${path}`, { signal, credentials: "omit" });
  if (!response.ok) throw new Error("Unable to load this page. Please try again.");
  return response.json();
}
export async function fetchSearchClient(query: string, page = 1): Promise<SearchResponse> {
  const data = await readBackend<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}&page=${page}`);
  return { results: data.results.map(item => ({ ...item, "detail-link": pagesRoute(item["detail-link"]) })) };
}
