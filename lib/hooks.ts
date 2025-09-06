import { useState, useEffect, useCallback } from 'react';

interface UseApiOptions {
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  staleTime?: number;
}

interface UseApiResult<T> { data: T | null; loading: boolean; error: string | null; refetch: () => void }

export function useApi<T>(
  apiFunction: () => Promise<T>,
  dependencies: any[] = [],
  options: UseApiOptions = {}
): UseApiResult<T> {
  const {
    enabled = true,
    refetchOnWindowFocus = false,
    staleTime = 5 * 60 * 1000 // 5 minutes
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    
    // Skip if data is still fresh
    const now = Date.now();
    if (data && now - lastFetch < staleTime) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiFunction();
      setData(result);
      setLastFetch(now);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [apiFunction, enabled, data, lastFetch, staleTime]);

  const refetch = useCallback(() => {
    setLastFetch(0); // Force refetch
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData, ...dependencies]);

  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleFocus = () => {
      // Only refetch if data is stale
      if (Date.now() - lastFetch > staleTime) {
        refetch();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, refetch, lastFetch, staleTime]);

  return { data, loading, error, refetch };
}

// Specific hooks for common API calls
import { fetchRecent, fetchPopular, fetchDrama, fetchEpisode, fetchSearch, RecentResponse, PopularResponse, SearchResponse, DramaResponse } from './api';

export function useRecentDramas(page: number = 1) {
  return useApi<RecentResponse>(() => fetchRecent(page), [page], { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: true });
}

export function usePopularDramas(page: number = 1) {
  return useApi<PopularResponse>(() => fetchPopular(page), [page], { staleTime: 10 * 60 * 1000, refetchOnWindowFocus: true });
}

export function useDramaDetails(slug: string) {
  return useApi<DramaResponse>(() => fetchDrama(slug), [slug], { staleTime: 30 * 60 * 1000, enabled: !!slug });
}

export function useEpisodeDetails(slug: string, episode: string) {
  return useApi<unknown>(() => fetchEpisode(slug, episode), [slug, episode], { staleTime: 60 * 60 * 1000, enabled: !!(slug && episode) });
}

export function useSearchResults(query: string, page: number = 1) {
  return useApi<SearchResponse>(() => fetchSearch(query, page), [query, page], { staleTime: 15 * 60 * 1000, enabled: !!query.trim() });
}
