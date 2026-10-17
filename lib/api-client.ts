import type { SearchResponse } from "./api-types";

export async function fetchSearchClient(query: string, page = 1): Promise<SearchResponse> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&page=${page}`);
  if (!response.ok) throw new Error(`Search failed ${response.status}`);
  return response.json();
}

