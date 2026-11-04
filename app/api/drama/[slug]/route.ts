import { NextResponse } from "next/server";
import { fetchDrama } from "@/lib/api";
import { detailNeedsRefresh } from '@/lib/detail-cache';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const data = await fetchDrama((await params).slug);
    return NextResponse.json(data, { headers: { 'Cache-Control': detailNeedsRefresh(data) ? 'no-store' : 'public, max-age=60, stale-while-revalidate=300' } });
  } catch (error) {
    console.error("Drama metadata lookup failed:", error);
    return NextResponse.json({ error: "Drama unavailable" }, { status: 502 });
  }
}
