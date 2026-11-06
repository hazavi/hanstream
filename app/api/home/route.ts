import {readerErrorResponse} from '@/lib/reader-response';
import { NextResponse } from "next/server";
import { getHomeData } from '@/lib/home';
export const dynamic = "force-dynamic";
export async function GET() {
  const started = performance.now();
  try {
    const data = await getHomeData();
    return NextResponse.json(data, { headers: { 'Cache-Control': data.partial ? 'no-store' : 'public, max-age=30, stale-while-revalidate=60', 'Server-Timing': `home;dur=${(performance.now() - started).toFixed(1)}` } });
  } catch(error) { return readerErrorResponse(error,"Drama listings unavailable"); }
}
