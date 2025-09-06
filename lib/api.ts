const BASE = 'https://kdrama-one.vercel.app';

// Cache management
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const pendingRequests = new Map<string, Promise<any>>();

// Cache TTL in milliseconds
const CACHE_TTL = {
  recent: 5 * 60 * 1000,     // 5 minutes for recent episodes
  popular: 10 * 60 * 1000,   // 10 minutes for popular shows
  drama: 30 * 60 * 1000,     // 30 minutes for drama details
  episode: 60 * 60 * 1000,   // 1 hour for episode data
  search: 15 * 60 * 1000,    // 15 minutes for search results
};

function getCacheKey(endpoint: string): string {
  return endpoint;
}

function isValidCache(cacheEntry: { timestamp: number; ttl: number }): boolean {
  return Date.now() - cacheEntry.timestamp < cacheEntry.ttl;
}

async function get(path: string, cacheTTL: number = 0, init?: RequestInit) {
  const cacheKey = getCacheKey(path);
  
  // Check cache first
  if (cacheTTL > 0) {
    const cached = cache.get(cacheKey);
    if (cached && isValidCache(cached)) {
      return cached.data;
    }
  }
  
  // Check if request is already pending (deduplication)
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }
  
  // Make new request
  const requestPromise = fetch(BASE + path, { 
    ...init, 
    headers: { 
      ...(init?.headers || {}), 
      'Accept': 'application/json',
      'Cache-Control': 'public, max-age=300' // 5 minutes browser cache
    } 
  }).then(async (res) => {
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    const data = await res.json();
    
    // Store in cache if TTL specified
    if (cacheTTL > 0) {
      cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl: cacheTTL
      });
    }
    
    return data;
  }).finally(() => {
    // Remove from pending requests
    pendingRequests.delete(cacheKey);
  });
  
  // Store pending request
  pendingRequests.set(cacheKey, requestPromise);
  
  return requestPromise;
}

export async function fetchRecent(page: number = 1) {
  return get(`/recently-added${page > 1 ? `?page=${page}` : ''}`, CACHE_TTL.recent);
}

export async function fetchPopular(page: number = 1) {
  return get(`/popular${page > 1 ? `?page=${page}` : ''}`, CACHE_TTL.popular);
}

export async function fetchDrama(slug: string) {
  return get(`/${slug}`, CACHE_TTL.drama);
}

export async function fetchEpisode(slug: string, episode: string) {
  return get(`/${slug}/episode/${episode}`, CACHE_TTL.episode);
}

export async function fetchSearch(query: string, page: number = 1) {
  const q = query.trim().toLowerCase().replace(/\s+/g, '-');
  const pageParam = page > 1 ? `&page=${page}` : '';
  return get(`/search?q=${encodeURIComponent(q)}${pageParam}`, CACHE_TTL.search);
}

// Next.js cached versions for server components
export async function fetchRecentCached(page: number = 1) {
  const response = await fetch(`${BASE}/recently-added${page > 1 ? `?page=${page}` : ''}`, {
    next: { 
      revalidate: 300, // 5 minutes
      tags: ['recent-dramas']
    }
  });
  if (!response.ok) throw new Error(`Request failed ${response.status}`);
  return response.json();
}

export async function fetchPopularCached(page: number = 1) {
  const response = await fetch(`${BASE}/popular${page > 1 ? `?page=${page}` : ''}`, {
    next: { 
      revalidate: 600, // 10 minutes
      tags: ['popular-dramas']
    }
  });
  if (!response.ok) throw new Error(`Request failed ${response.status}`);
  return response.json();
}

export async function fetchDramaCached(slug: string) {
  const response = await fetch(`${BASE}/${slug}`, {
    next: { 
      revalidate: 1800, // 30 minutes
      tags: [`drama-${slug}`]
    }
  });
  if (!response.ok) throw new Error(`Request failed ${response.status}`);
  return response.json();
}

export async function fetchEpisodeCached(slug: string, episode: string) {
  const response = await fetch(`${BASE}/${slug}/episode/${episode}`, {
    next: { 
      revalidate: 3600, // 1 hour
      tags: [`episode-${slug}-${episode}`]
    }
  });
  if (!response.ok) throw new Error(`Request failed ${response.status}`);
  return response.json();
}

export async function fetchSearchCached(query: string, page: number = 1) {
  const q = query.trim().toLowerCase().replace(/\s+/g, '-');
  const pageParam = page > 1 ? `&page=${page}` : '';
  const response = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}${pageParam}`, {
    next: { 
      revalidate: 900, // 15 minutes
      tags: [`search-${q}`]
    }
  });
  if (!response.ok) throw new Error(`Request failed ${response.status}`);
  return response.json();
}

// Cache utilities
export function clearCache() {
  cache.clear();
  pendingRequests.clear();
}

export function clearCacheByPattern(pattern: string) {
  for (const [key] of cache) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

// Preload common data
export async function preloadHomeData() {
  // Preload both recent and popular data in parallel
  await Promise.all([
    fetchRecent(1),
    fetchPopular(1)
  ]);
}

// Batch requests utility
export async function batchRequests<T>(requests: (() => Promise<T>)[], batchSize: number = 3): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(req => req()));
    results.push(...batchResults);
    
    // Small delay between batches to prevent overwhelming the server
    if (i + batchSize < requests.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

export type RecentItem = {
  'episode-link': string;
  episode_number: number;
  image: string;
  time: string;
  title: string;
  type: string;
};

export type PopularItem = {
  'detail-link': string;
  image: string;
  title: string;
};

export type SearchResultItem = {
  'detail-link': string;
  image: string;
  title: string;
};

// Utility function to format relative time
export function formatRelativeTime(timeString: string): string {
  try {
    // Handle various time formats from the API
    let date: Date;
    
    // If it's already relative (like "4 minutes ago"), return as is
    if (timeString.includes('ago') || timeString.includes('hours') || timeString.includes('minutes')) {
      return timeString;
    }
    
    // Try to parse ISO date or other formats
    if (timeString.includes('T') || timeString.includes('-')) {
      date = new Date(timeString);
    } else {
      // Fallback for other formats
      date = new Date(timeString);
    }
    
    // If invalid date, return original string
    if (isNaN(date.getTime())) {
      return timeString;
    }
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    
    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
    return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
  } catch {
    return timeString;
  }
}
