import { NextResponse } from "next/server";
import { getHomeData } from '@/lib/home';
export const dynamic = "force-dynamic";
export async function GET() {
  const started = performance.now();
  try {
    return NextResponse.json(await getHomeData(), { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60', 'Server-Timing': `home;dur=${(performance.now() - started).toFixed(1)}` } });
  } catch { return NextResponse.json({ error: "Drama listings unavailable" }, { status: 502 }); }
}
