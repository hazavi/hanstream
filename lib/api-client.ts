import type { SearchResponse } from "./api-types";
import {readBackend} from './pages-client';

export async function fetchSearchClient(query: string, page = 1, signal?: AbortSignal): Promise<SearchResponse> {
  return readBackend<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}&page=${page}&preview=1`,signal,{sameOrigin:true});
}

