/** Server-side Simkl API client. Numeric Simkl IDs are our stable route keys. */
export type SimklItem = {
  title: string;
  year?: number;
  date?: string;
  poster?: string | null;
  url?: string;
  overview?: string;
  runtime?: number;
  status?: string;
  genres?: string[];
  country?: string;
  total_episodes?: number;
  ids?: { simkl?: number; simkl_id?: number; slug?: string };
  ratings?: { simkl?: { rating?: number } };
};

export type SimklEpisode = {
  title: string;
  season?: number;
  episode?: number;
  type?: string;
  aired?: boolean;
  date?: string | null;
};

export function simklId(item: SimklItem): number | undefined {
  return item.ids?.simkl ?? item.ids?.simkl_id;
}

export function simklPoster(path?: string | null): string {
  return path
    ? `https://wsrv.nl/?url=${encodeURIComponent(`https://simkl.in/posters/${path}_m.webp`)}&q=90`
    : "https://simkl.in/poster_no_pic_c.png";
}

export function simklLink(item: SimklItem, type: "tv" | "movies" = "tv"): string {
  if (item.url?.startsWith(`/${type}/`)) return `https://simkl.com${item.url}`;
  return `https://simkl.com/${type}/${simklId(item)}/${item.ids?.slug || ""}`;
}

export function simklHeaders(): HeadersInit {
  return {
    "User-Agent": "HanStream/0.1.0 (https://hanstream.site)",
    ...(process.env.SIMKL_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.SIMKL_ACCESS_TOKEN}` } : {}),
  };
}

export async function simklGet<T>(path: string, revalidate = 3600): Promise<T> {
  const clientId = process.env.SIMKL_CLIENT_ID;
  if (!clientId) throw new Error("SIMKL_CLIENT_ID is required. Add it to .env.local.");
  const url = new URL(path, "https://api.simkl.com");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("app-name", "hanstream");
  url.searchParams.set("app-version", "0.1.0");
  const response = await fetch(url, {
    headers: simklHeaders(),
    next: { revalidate },
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401) throw new Error("Simkl requires SIMKL_ACCESS_TOKEN for this client ID");
  if (!response.ok) throw new Error(`Simkl returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function getSimklDrama(id: string): Promise<SimklItem> {
  if (!/^\d+$/.test(id)) throw new Error("Invalid Simkl TV ID");
  return simklGet<SimklItem>(`/tv/${id}`, 86400);
}

export async function getSimklMovie(id: string): Promise<SimklItem> {
  if (!/^\d+$/.test(id)) throw new Error("Invalid Simkl movie ID");
  return simklGet<SimklItem>(`/movies/${id}`, 86400);
}

export async function getSimklEpisodes(id: string): Promise<SimklEpisode[]> {
  if (!/^\d+$/.test(id)) throw new Error("Invalid Simkl TV ID");
  return simklGet<SimklEpisode[]>(`/tv/episodes/${id}`, 86400);
}
