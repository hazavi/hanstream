import "server-only";
import * as api from "./source-api";
import { getHomeData } from "./source-home";
import { readSourceArtwork } from "./source-artwork";
import { readSourcePortrait } from "./source-portrait";
import {
  parseReaderJob,
  type ReaderJob,
  type ReaderImage,
} from "./reader-protocol";
async function imageResult(response: Response): Promise<ReaderImage> {
  if (response.status >= 500) throw new Error("Image reader is busy.");
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > 1_000_000) throw new Error("Image result is too large.");
  const headers: Record<string, string> = {};
  for (const key of [
    "content-type",
    "cache-control",
    "etag",
    "x-artwork-available",
    "content-security-policy",
    "x-content-type-options",
  ]) {
    const value = response.headers.get(key);
    if (value) headers[key] = value;
  }
  return { status: response.status, body: body.toString("base64"), headers };
}
export async function executeReaderJob(input: ReaderJob): Promise<unknown> {
  if (process.env.VERCEL === "1" || process.env.HANSTREAM_ROLE === "web")
    throw new Error("Source readers cannot run in the website deployment.");
  const job = parseReaderJob(input);
  switch (job.kind) {
    case "home":
      return getHomeData();
    case "recent":
      return api.fetchRecent(job.page);
    case "popular":
      return api.fetchPopular(job.page);
    case 'browse':
      return api.fetchCategory(job.category, job.page);
    case "movies":
      return api.fetchRecentMovies(job.page);
    case "rankings":
      return api.fetchPopularSeries();
    case "hot":
      return api.fetchHotSeries();
    case "search":
      return api.fetchSearch(job.query, job.page, job.preview);
    case "drama":
      return api.fetchDrama(job.slug);
    case "episode":
      return {
        ...(await api.fetchEpisode(job.slug, job.episode)),
        drama: api.peekDrama(job.slug)?.result,
      };
    case "artwork":
      return imageResult(
        await readSourceArtwork(
          new Request(
            "https://reader.invalid/api/artwork?" +
              new URLSearchParams({
                title: job.title,
                ...(job.year ? { year: String(job.year) } : {}),
                secondary: job.secondary ? "1" : "0",
                width: String(job.width),
              }),
          ),
        ),
      );
    case "portrait":
      return imageResult(
        await readSourcePortrait(
          new Request(
            "https://reader.invalid/api/portrait?" +
              new URLSearchParams({
                name: job.name,
                ...(job.key ? { key: job.key } : {}),
                width: String(job.width),
              }),
          ),
        ),
      );
  }
}
