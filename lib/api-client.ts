import type { SearchResponse } from "./api-types";

export async function fetchSearchClient(query: string, page = 1, signal?: AbortSignal): Promise<SearchResponse> {
  const timeout = AbortSignal.timeout(8000);
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&page=${page}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new Error(`Search failed ${response.status}`);
  return response.json();
}

