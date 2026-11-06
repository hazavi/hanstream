import {readerErrorResponse} from '@/lib/reader-response';
import { NextResponse } from "next/server";
import { fetchPopular, fetchRecent, fetchRecentMovies } from "@/lib/api";
import {publicCatalogHeaders} from '@/lib/public-cache';
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const page = Math.min(2000, Math.max(1, Math.floor(Number(query.get("page")) || 1)));
  const kind = query.get("kind") || "recent";
  if (!["recent", "movies", "popular"].includes(kind)) return NextResponse.json({ error: "Invalid catalog" }, { status: 400 });
  try {
    const read = async (p: number) => {
      if (kind === "popular") return (await fetchPopular(p)).results;
      if (kind === "recent") return (await fetchRecent(p)).results;
      return (await fetchRecentMovies(p)).result.movies.map(item => ({ "episode-link": item.id, episode_number: Number(item.ep), image: item.img, time: item.time, title: item.title, type: item.type }));
    };
    const items=await read(page);
    // Do not crawl another archive page before displaying this page's results.
    return NextResponse.json({items,page,hasNext:page<2000&&items.length>=20},{headers:items.length?publicCatalogHeaders():{'Cache-Control':'no-store'}});
  } catch(error) { return readerErrorResponse(error,"Drama listings unavailable"); }
}
