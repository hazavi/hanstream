import { NextResponse } from "next/server";
import { fetchHotSeries, fetchPopular, fetchPopularSeries, fetchRecent } from "@/lib/api";
import { getHomepage } from "@/lib/metadata";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const [home, recent, popular, rankings, hero] = await Promise.all([getHomepage(), fetchRecent(), fetchPopular(), fetchPopularSeries(), fetchHotSeries()]);
    return NextResponse.json({ home, recent: recent.results.slice(0, 12), popular: popular.results.slice(0, 12), rankings: rankings.result, hero: hero.result.updates });
  } catch { return NextResponse.json({ error: "Drama listings unavailable" }, { status: 502 }); }
}
