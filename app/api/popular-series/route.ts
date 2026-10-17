import { NextResponse } from "next/server";
import { fetchPopularSeries } from "@/lib/api";

export async function GET() {
  try {
    return NextResponse.json(await fetchPopularSeries());
  } catch (error) {
    console.error("Drama rankings failed:", error);
    return NextResponse.json({ error: "Drama rankings are temporarily unavailable" }, { status: 502 });
  }
}
