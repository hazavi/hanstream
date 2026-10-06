import { NextResponse } from "next/server";
import { fetchPopularSeries } from "@/lib/api";

export async function GET() {
  try {
    return NextResponse.json(await fetchPopularSeries());
  } catch (error) {
    console.error("Simkl trending failed:", error);
    return NextResponse.json({ error: "Trending shows are temporarily unavailable" }, { status: 502 });
  }
}
