import {readerErrorResponse} from '@/lib/reader-response';
import { NextResponse } from "next/server";
import { fetchPopular, fetchRecent, fetchRecentMovies } from "@/lib/api";
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
    const [items, next] = await Promise.all([read(page), page < 2000 ? read(page + 1) : Promise.resolve([])]);
    return NextResponse.json({ items, page, hasNext: next.length > 0 });
  } catch(error) { return readerErrorResponse(error,"Drama listings unavailable"); }
}
